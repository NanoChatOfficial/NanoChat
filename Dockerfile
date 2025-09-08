FROM alpine:latest

RUN apk update && \
    apk add --no-cache \
      python3 \
      py3-pip \
      build-base \
      tor \
      bash \
      nodejs \
      npm \
      git \
      curl

RUN npm install -g pnpm

WORKDIR /app

COPY backend/requirements.txt backend/
RUN pip3 install --no-cache-dir -r backend/requirements.txt --break-system-packages

COPY . .

RUN mkdir -p /etc/tor /var/lib/tor/hidden_service && \
    chmod 700 /var/lib/tor/hidden_service && \
    echo "HiddenServiceDir /var/lib/tor/hidden_service/" > /etc/tor/torrc && \
    echo "HiddenServicePort 80 127.0.0.1:5173" >> /etc/tor/torrc && \
    echo "HiddenServicePort 8000 127.0.0.1:8000" >> /etc/tor/torrc

WORKDIR /app/frontend
RUN pnpm install

EXPOSE 5173
EXPOSE 8000
EXPOSE 80

WORKDIR /app/backend

COPY docker/start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["bash", "/app/start.sh"]
