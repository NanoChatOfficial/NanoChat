# NanoChat

## An end-to-end encrypted anonymous webchat

<!-- FEATURES -->
## Features:

- Small codebase

- Messages expire after 7 days

- Docker support

- Written in Rust

## Technical details:

- AES-256-GCM for client-side encryption

- Key is not sent to server

<!-- INSTALLATION -->
## Server setup:

    sudo apt update
    sudo apt install curl build-essential git
    curl https://sh.rustup.rs -sSf | sh -s -- -y
    git clone https://github.com/umutcamliyurt/NanoChat.git
    cd NanoChat/
    cargo build --release
    cargo run --release

## Server setup with Docker:

    git clone https://github.com/umutcamliyurt/NanoChat
    cd NanoChat/
    docker build -t nanochat .
    docker run -d --network=host --name nanochat nanochat

## Requirements:

- [Rust](https://www.rust-lang.org), [Tor](https://gitlab.torproject.org/tpo/core/tor)

<!-- SCREENSHOT -->
## Screenshot:

![Screenshot](screenshot.png)

<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE` for more information.