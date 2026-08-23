FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y git cmake build-essential libssl-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Pre-build liboqs C library during image build so startup is instant
RUN python -c "import oqs"

COPY . .

EXPOSE 5001
ENV PYTHONUNBUFFERED=1

CMD ["python", "app.py"]
