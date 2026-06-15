import asyncio
import asyncpg
import os
import shutil

PCAP_DIR = '/app/pcap_storage'
REAL_PCAP = os.path.join(PCAP_DIR, '3ce774d4-ad69-4cd4-936c-3cda149c93a4.pcap')
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://kanadshield:password@postgres/kanadshield')

async def fix():
    conn = await asyncpg.connect(DATABASE_URL)
    sessions = await conn.fetch('SELECT session_id, filename FROM sessions')
    print(f"Found {len(sessions)} sessions in DB")
    for s in sessions:
        sid = str(s['session_id'])
        target = os.path.join(PCAP_DIR, sid + '.pcap')
        if not os.path.exists(target):
            if os.path.exists(REAL_PCAP):
                shutil.copy2(REAL_PCAP, target)
                print(f'[CREATED] {target}')
            else:
                print(f'[MISSING] Source PCAP not found: {REAL_PCAP}')
        else:
            print(f'[EXISTS]  {target}')
    await conn.close()
    print('Done.')

asyncio.run(fix())
