FROM alpine:latest

RUN apk update && apk add --no-cache \
    python3 \
    py3-pip \
    build-base \
    tor \
    tzdata \
    bash \
    nodejs \
    npm \
    git \
    curl \
    libc6-compat \
    make \
    g++

RUN npm install -g pnpm && \
    pip3 install --no-cache-dir pipenv --break-system-packages

WORKDIR /app

COPY backend/Pipfile backend/Pipfile.lock backend/
ENV PIP_BREAK_SYSTEM_PACKAGES=1
RUN cd backend && python3 -m pipenv sync --system

COPY . .

RUN mkdir -p /etc/tor /var/lib/tor/hidden_service && \
    chmod 700 /var/lib/tor/hidden_service && \
    echo "HiddenServiceDir /var/lib/tor/hidden_service/" > /etc/tor/torrc && \
    echo "HiddenServicePort 80 127.0.0.1:4173" >> /etc/tor/torrc && \
    echo "HiddenServicePort 8000 127.0.0.1:8000" >> /etc/tor/torrc

VOLUME ["/var/lib/tor/hidden_service"]

WORKDIR /app/frontend

RUN rm -rf node_modules
RUN pnpm install --frozen-lockfile --unsafe-perm --reporter=silent

EXPOSE 4173 8000 80

WORKDIR /app/backend

COPY docker/start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["bash", "/app/start.sh"]
