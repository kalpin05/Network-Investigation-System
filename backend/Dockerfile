FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    tshark libpcap-dev gcc libpango-1.0-0 libpangoft2-1.0-0 \
    fonts-noto fonts-noto-cjk fonts-indic \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--loop", "asyncio", "--reload"]
