FROM alpine:latest

RUN apk update && \
    apk add --no-cache \
    curl \
    build-base \
    git \
    rust \
    tor \
    bash

RUN curl https://sh.rustup.rs -sSf | sh -s -- -y

ENV PATH="/root/.cargo/bin:${PATH}"

RUN git clone https://github.com/umutcamliyurt/NanoChat.git

WORKDIR /NanoChat

RUN cargo build --release

RUN mkdir -p /etc/tor /var/lib/tor/hidden_service && \
    chmod 700 /var/lib/tor/hidden_service && \
    echo "HiddenServiceDir /var/lib/tor/hidden_service/" > /etc/tor/torrc && \
    echo "HiddenServicePort 80 127.0.0.1:8000" >> /etc/tor/torrc

EXPOSE 8000

CMD bash -c '\
    tor & \
    while [ ! -f /var/lib/tor/hidden_service/hostname ]; do sleep 1; done; \
    echo "NanoChat onion service available at: $(cat /var/lib/tor/hidden_service/hostname)"; \
    cargo run --release \
'
