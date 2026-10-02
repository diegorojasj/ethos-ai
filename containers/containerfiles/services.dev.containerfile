FROM python:3.14-alpine
ENV PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.default /app/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/requirements.txt

CMD ["sh", "-c", "python main.py migrate --noinput && python main.py runserver 0.0.0.0:${PORT:-8000}"]
