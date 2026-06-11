import io
import os
import zipfile
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import Response, StreamingResponse
from db.postgres import get_pool
from config import PCAP_STORAGE
from utils.custody import log_custody
from routers.auth import get_current_user, check_role
from weasyprint import HTML
from datetime import datetime

router = APIRouter()

@router.get("/api/evidence/{session_id}")
async def download_evidence(
    session_id: str,
    request: Request,
    current_user: dict = Depends(check_role(["admin", "investigator"]))
):
    """
    Downloads original PCAP + SHA-256 hash + custody log in a ZIP archive.
    Logs custody access.
    """
    # Log to Chain of Custody first so it is included in the exported log
    await log_custody(
        session_id=session_id,
        user_id=current_user.get("user_id"),
        action="export",
        ip_address=request.client.host if request.client else "127.0.0.1"
    )

    pool = await get_pool()
    async with pool.acquire() as conn:
        session = await conn.fetchrow(
            "SELECT filename, sha256_hash, upload_time, packet_count FROM sessions WHERE session_id = $1",
            session_id
        )
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        custody_rows = await conn.fetch(
            """
            SELECT cl.action, cl.accessed_at, cl.ip_address, u.username
            FROM custody_log cl
            LEFT JOIN users u ON u.user_id = cl.user_id
            WHERE cl.session_id = $1
            ORDER BY cl.accessed_at ASC
            """,
            session_id
        )
        
    pcap_path = os.path.join(PCAP_STORAGE, f"{session_id}.pcap")
    if not os.path.exists(pcap_path):
        raise HTTPException(status_code=404, detail="PCAP file not found on server")

    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        # Write PCAP file using its original filename
        zip_file.write(pcap_path, arcname=session["filename"])
        
        # Write SHA-256 hash file
        hash_content = (
            f"KanadShield Evidence Hash File\n"
            f"================================\n"
            f"Session ID  : {session_id}\n"
            f"Filename    : {session['filename']}\n"
            f"SHA-256     : {session['sha256_hash']}\n"
            f"Upload Time : {session['upload_time']}\n"
            f"Packet Count: {session['packet_count']}\n"
        )
        zip_file.writestr("sha256_verification.txt", hash_content)
        
        # Chain of custody log file
        custody_lines = [
            "KanadShield Chain of Custody Log",
            "================================",
            f"Session: {session_id}",
            f"File   : {session['filename']}",
            "",
            f"{'Timestamp':<30} {'User':<20} {'Action':<15} {'IP Address'}",
            "-" * 80,
        ]
        for row in custody_rows:
            custody_lines.append(
                f"{str(row['accessed_at']):<30} "
                f"{(row['username'] or 'unknown'):<20} "
                f"{row['action']:<15} "
                f"{row['ip_address']}"
            )
        zip_file.writestr("chain_of_custody.txt", "\n".join(custody_lines))
        
    zip_buffer.seek(0)

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=evidence_{session_id[:8]}.zip"}
    )


@router.get("/api/cases/{case_id}/export")
async def export_case_report(
    case_id: str,
    request: Request,
    current_user: dict = Depends(check_role(["admin", "investigator"]))
):
    """
    Generates a PDF case report using WeasyPrint.
    Logs custody access for all evidence sessions.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        case = await conn.fetchrow("SELECT * FROM cases WHERE case_id = $1", case_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
            
        alerts = await conn.fetch(
            "SELECT * FROM alerts WHERE case_id = $1 ORDER BY fired_at DESC",
            case_id
        )
        
        # Get unique session IDs from alerts to list evidence
        session_ids = list(set([str(a["session_id"]) for a in alerts if a["session_id"]]))
        sessions = []
        custody_rows = []
        if session_ids:
            sessions = await conn.fetch(
                "SELECT session_id, filename, sha256_hash, upload_time, packet_count FROM sessions WHERE session_id = ANY($1)",
                session_ids
            )
            # Fetch custody logs for these sessions
            custody_rows = await conn.fetch(
                """
                SELECT cl.session_id, cl.action, cl.accessed_at, cl.ip_address, u.username
                FROM custody_log cl
                LEFT JOIN users u ON u.user_id = cl.user_id
                WHERE cl.session_id = ANY($1)
                ORDER BY cl.accessed_at ASC
                """,
                session_ids
            )

    # Log custody logs for each session
    client_ip = request.client.host if request.client else "127.0.0.1"
    for sid in session_ids:
        await log_custody(
            session_id=sid,
            user_id=current_user.get("user_id"),
            action="export_report",
            ip_address=client_ip
        )

    # Format HTML
    evidence_html = ""
    for s in sessions:
        evidence_html += f"""
        <tr>
            <td style="font-family: monospace; font-size: 11px;">{s['session_id']}</td>
            <td>{s['filename']}</td>
            <td style="font-family: monospace; font-size: 11px;">{s['sha256_hash']}</td>
            <td>{s['packet_count']}</td>
            <td>{s['upload_time'].strftime('%Y-%m-%d %H:%M:%S') if s['upload_time'] else '-'}</td>
        </tr>
        """
    if not sessions:
        evidence_html = "<tr><td colspan='5' style='text-align: center;'>No evidence files linked.</td></tr>"

    custody_html = ""
    for c in custody_rows:
        custody_html += f"""
        <tr>
            <td>{c['accessed_at'].strftime('%Y-%m-%d %H:%M:%S') if c['accessed_at'] else '-'}</td>
            <td>{c['username'] or 'System'}</td>
            <td style="text-transform: uppercase; font-weight: bold;">{c['action'].replace('_', ' ')}</td>
            <td style="font-family: monospace; font-size: 11px;">{c['session_id']}</td>
            <td style="font-family: monospace;">{c['ip_address']}</td>
        </tr>
        """
    if not custody_rows:
        custody_html = "<tr><td colspan='5' style='text-align: center;'>No custody logs found.</td></tr>"

    alerts_html = ""
    for a in alerts:
        severity_class = a["severity"].lower()
        alerts_html += f"""
        <tr>
            <td>{a['fired_at'].strftime('%Y-%m-%d %H:%M:%S') if a['fired_at'] else '-'}</td>
            <td style="font-family: monospace;">{a['rule_name']}</td>
            <td class="{severity_class}">{a['severity'].upper()}</td>
            <td style="font-family: monospace;">{a['src_ip']}</td>
            <td style="font-family: monospace;">{a['dst_ip']}</td>
            <td>{a['description']}</td>
        </tr>
        """
    if not alerts:
        alerts_html = "<tr><td colspan='6' style='text-align: center;'>No alerts linked.</td></tr>"

    html_content = f"""
    <html>
    <head>
        <meta charset="utf-8">
        <title>KanadShield Case Report - {case['title']}</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                margin: 40px;
                color: #1f2937;
                line-height: 1.5;
            }}
            .header {{
                border-bottom: 3px solid #1e3a8a;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }}
            .logo {{
                font-size: 28px;
                font-weight: bold;
                color: #1e3a8a;
            }}
            .subtitle {{
                font-size: 12px;
                color: #6b7280;
                margin-top: 5px;
            }}
            h1 {{
                font-size: 22px;
                color: #111827;
                margin-top: 0;
            }}
            h2 {{
                font-size: 16px;
                color: #1e3a8a;
                border-bottom: 1px solid #e5e7eb;
                padding-bottom: 5px;
                margin-top: 30px;
            }}
            .meta-grid {{
                display: table;
                width: 100%;
                margin-bottom: 20px;
            }}
            .meta-row {{
                display: table-row;
            }}
            .meta-label {{
                display: table-cell;
                font-weight: bold;
                width: 120px;
                padding: 4px 0;
            }}
            .meta-value {{
                display: table-cell;
                padding: 4px 0;
            }}
            .notes {{
                background: #f9fafb;
                border-left: 4px solid #1e3a8a;
                padding: 15px;
                margin-bottom: 25px;
                font-size: 13px;
                white-space: pre-wrap;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin-top: 15px;
                font-size: 11px;
            }}
            th, td {{
                border: 1px solid #e5e7eb;
                padding: 8px 10px;
                text-align: left;
                vertical-align: top;
            }}
            th {{
                background: #f3f4f6;
                color: #374151;
                font-weight: bold;
            }}
            .critical {{
                color: #b91c1c;
                font-weight: bold;
            }}
            .high {{
                color: #ea580c;
                font-weight: bold;
            }}
            .medium {{
                color: #d97706;
                font-weight: bold;
            }}
            .low {{
                color: #1d4ed8;
                font-weight: bold;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">KanadShield Forensic Investigation</div>
            <div class="subtitle">Official Evidence & Incident Report • Generated {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
        </div>
        
        <h1>Case: {case['title']}</h1>
        
        <div class="meta-grid">
            <div class="meta-row">
                <div class="meta-label">Case ID:</div>
                <div class="meta-value" style="font-family: monospace;">{case['case_id']}</div>
            </div>
            <div class="meta-row">
                <div class="meta-label">Status:</div>
                <div class="meta-value" style="text-transform: uppercase; font-weight: bold;">{case['status']}</div>
            </div>
            <div class="meta-row">
                <div class="meta-label">Created At:</div>
                <div class="meta-value">{case['created_at'].strftime('%Y-%m-%d %H:%M:%S') if case['created_at'] else '-'}</div>
            </div>
        </div>
        
        <h2>Investigator Notes</h2>
        <div class="notes">{case['notes'] or 'No investigator notes added.'}</div>
        
        <h2>Evidence Files</h2>
        <table>
            <thead>
                <tr>
                    <th>Session ID</th>
                    <th>Filename</th>
                    <th>SHA-256 Cryptographic Hash</th>
                    <th>Packets</th>
                    <th>Ingestion Date</th>
                </tr>
            </thead>
            <tbody>
                {evidence_html}
            </tbody>
        </table>

        <h2>Chain of Custody Logs</h2>
        <table>
            <thead>
                <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Session ID</th>
                    <th>IP Address</th>
                </tr>
            </thead>
            <tbody>
                {custody_html}
            </tbody>
        </table>
        
        <h2>Linked Alerts</h2>
        <table>
            <thead>
                <tr>
                    <th>Fired At</th>
                    <th>Rule Name</th>
                    <th>Severity</th>
                    <th>Source IP</th>
                    <th>Destination IP</th>
                    <th>Description</th>
                </tr>
            </thead>
            <tbody>
                {alerts_html}
            </tbody>
        </table>
    </body>
    </html>
    """

    pdf_bytes = HTML(string=html_content).write_pdf()
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=case_report_{case_id[:8]}.pdf"}
    )


@router.get("/api/custody")
async def list_custody_logs(
    session_id: Optional[str] = None,
    current_user: dict = Depends(check_role(["admin", "investigator"]))
):
    """
    Lists audit logs for Chain of Custody tracking.
    """
    pool = await get_pool()
    query = """
        SELECT l.*, u.username
        FROM custody_log l
        LEFT JOIN users u ON u.user_id = l.user_id
    """
    params = []
    if session_id:
        params.append(session_id)
        query += " WHERE l.session_id = $1"
        
    query += " ORDER BY l.accessed_at DESC LIMIT 100"
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        
    return [dict(r) for r in rows]
