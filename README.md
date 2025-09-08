# NanoChat

## An end-to-end encrypted anonymous webchat

<!-- FEATURES -->

## Features:

- Small codebase

- Messages expire after 30 days

- Docker support

## Technical details:

- AES-256-GCM for client-side encryption

- Key is not sent to server

<!-- INSTALLATION -->

## Server setup:

This app uses `pipenv` to manage the dependencies and virtual environment.
Install using the instructions on [here](https://pypi.org/project/pipenv/).

    sudo apt update
    sudo apt install git python3 python3-pip
    git clone https://github.com/umutcamliyurt/NanoChat.git
    cd NanoChat/backend/
    python3 -m pipenv sync
    python3 -m pipenv shell
    python manage.py runserver

## Server setup with Docker:

    git clone https://github.com/umutcamliyurt/NanoChat
    cd NanoChat/
    docker build -t nanochat .
    docker run -d --network=host --name nanochat nanochat

## Requirements:

- [Python](https://www.python.org/downloads/), [Tor](https://gitlab.torproject.org/tpo/core/tor)

<!-- SCREENSHOT -->

## Screenshot:

![Screenshot](screenshot.png)

<!-- LICENSE -->

## License

Distributed under the MIT License. See `LICENSE` for more information.
