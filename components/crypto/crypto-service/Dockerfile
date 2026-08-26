FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y git cmake build-essential libssl-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Pre-build liboqs C library during image build so startup is instant
RUN python -c "import oqs" \
 && cp -r /root/_oqs /opt/oqs \
 && chmod -R 755 /opt/oqs

ENV OQS_DIR=/opt/oqs
ENV LD_LIBRARY_PATH=/opt/oqs/lib:$LD_LIBRARY_PATH

COPY . .

EXPOSE 5001
ENV PYTHONUNBUFFERED=1

# Run as a non-root user for container isolation
RUN addgroup --system --gid 1001 cryptoapp \
 && adduser  --system --uid 1001 --ingroup cryptoapp --no-create-home cryptoapp \
 && chown -R cryptoapp:cryptoapp /app
USER cryptoapp

CMD ["python", "app.py"]
