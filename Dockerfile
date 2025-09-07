FROM alpine:latest

RUN apk update && \
    apk add --no-cache \
    python3 \
    py3-pip \
    build-base \
    tor \
    bash

WORKDIR backend/

RUN pip3 install --no-cache-dir -r requirements.txt

RUN mkdir -p /etc/tor /var/lib/tor/hidden_service && \
    chmod 700 /var/lib/tor/hidden_service && \
    echo "HiddenServiceDir /var/lib/tor/hidden_service/" > /etc/tor/torrc && \
    echo "HiddenServicePort 8000 127.0.0.1:8000" >> /etc/tor/torrc

EXPOSE 8000

CMD bash -c '\
    tor & \
    while [ ! -f /var/lib/tor/hidden_service/hostname ]; do sleep 1; done; \
    echo "NanoChat onion service available at: $(cat /var/lib/tor/hidden_service/hostname)"; \
    python3 manage.py runserver 0.0.0.0:8000 \
'
