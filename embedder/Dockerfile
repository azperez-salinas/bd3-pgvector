FROM python:3.12-slim

WORKDIR /app

# PyTorch solo CPU (imagen mucho más liviana que la build con CUDA)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Los pesos se descargan en el primer arranque y se guardan en el volumen
ENV HF_HOME=/models
COPY app.py .

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
