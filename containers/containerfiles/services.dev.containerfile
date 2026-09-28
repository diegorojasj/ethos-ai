FROM python:3.14-alpine
ENV PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.default /app/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/requirements.txt

CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000} --reload"]
