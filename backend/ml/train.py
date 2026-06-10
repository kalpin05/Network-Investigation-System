import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from ml.anomaly import train_baseline

def generate_benign_sessions():
    sessions = []
    import random
    # Generate 500 benign sessions
    for _ in range(500):
        # A normal web session might have:
        # 5-50 packets, size ~200-1500, 1-2 ports, low entropy
        session = []
        packet_count = random.randint(5, 50)
        port = random.choice([80, 443])
        for _ in range(packet_count):
            session.append({
                "packet_length": random.randint(64, 1500),
                "dst_port": port,
                "payload_entropy": random.uniform(0.5, 3.0)
            })
        sessions.append(session)
    return sessions

if __name__ == "__main__":
    print("Generating benign traffic for baseline model...")
    benign_data = generate_benign_sessions()
    print("Training Isolation Forest Model...")
    train_baseline(benign_data)
    print("Model saved successfully!")
