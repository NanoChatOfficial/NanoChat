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

RUN npm install -g pnpm && \
    pip3 install --no-cache-dir pipenv --break-system-packages

WORKDIR /app

COPY backend/Pipfile backend/Pipfile.lock backend/


ENV PIP_BREAK_SYSTEM_PACKAGES=1
RUN cd backend && \
    python3 -m pipenv sync --system

COPY . .

RUN mkdir -p /etc/tor /var/lib/tor/hidden_service && \
    chmod 700 /var/lib/tor/hidden_service && \
    echo "HiddenServiceDir /var/lib/tor/hidden_service/" > /etc/tor/torrc && \
    echo "HiddenServicePort 80 127.0.0.1:4173" >> /etc/tor/torrc && \
    echo "HiddenServicePort 8000 127.0.0.1:8000" >> /etc/tor/torrc

WORKDIR /app/frontend
RUN pnpm install

EXPOSE 4173
EXPOSE 8000
EXPOSE 80

WORKDIR /app/backend

COPY docker/start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["bash", "/app/start.sh"]
