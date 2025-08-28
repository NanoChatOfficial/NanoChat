#[macro_use] 
extern crate rocket;

use rocket::data::{Data, FromData, Outcome, ToByteUnit};
use rocket::fs::{FileServer, NamedFile};
use rocket::http::Status;
use rocket::serde::{json::Json, Deserialize, Serialize};
use rocket::State;
use std::fs::{self, OpenOptions};
use std::io::{BufReader, BufWriter};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, Duration};
use chrono::{DateTime, Utc};

#[derive(Debug, Deserialize)]
struct Config {
    max_json_size: usize,
    max_user_len: usize,
    max_iv_len: usize,
    max_content_len: usize,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(crate = "rocket::serde")]
struct Message {
    id: usize,
    room: String,
    user: String,
    user_iv: String,
    content: String,
    iv: String,
    timestamp: String,
}

#[derive(Deserialize)]
#[serde(crate = "rocket::serde", deny_unknown_fields)]
struct NewMessage {
    user: String,
    user_iv: String,
    content: String,
    iv: String,
}


fn room_path(room: &str) -> PathBuf {
    Path::new("messages").join(room)
}

fn message_path(room: &str, id: usize) -> PathBuf {
    room_path(room).join(format!("{}.json", id))
}

fn save_message_to_file(message: &Message) -> std::io::Result<()> {
    let dir = room_path(&message.room);
    fs::create_dir_all(&dir)?;
    let file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(message_path(&message.room, message.id))?;
    let mut w = BufWriter::new(file);
    serde_json::to_writer(&mut w, message)?;
    Ok(())
}

fn cleanup_expired_messages() -> std::io::Result<()> {
    let messages_dir = Path::new("messages");
    if !messages_dir.exists() {
        return Ok(());
    }

    let expiration_duration = Duration::from_secs(7 * 24 * 60 * 60);

    for room_entry in fs::read_dir(messages_dir)? {
        let room_entry = room_entry?;
        let room_path = room_entry.path();
        if room_path.is_dir() {
            for file_entry in fs::read_dir(&room_path)? {
                let file_entry = file_entry?;
                let file_path = file_entry.path();
                if let Ok(metadata) = file_path.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        if SystemTime::now().duration_since(modified).unwrap_or_default() > expiration_duration {
                            fs::remove_file(&file_path)?;
                            println!("Removed expired message: {:?}", file_path);
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

fn load_messages(room: &str) -> Vec<Message> {
    let dir = room_path(room);
    if !dir.exists() {
        return Vec::new();
    }

    let mut messages = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Ok(file) = OpenOptions::new().read(true).open(entry.path()) {
                let reader = BufReader::new(file);
                if let Ok(message) = serde_json::from_reader(reader) {
                    messages.push(message);
                }
            }
        }
    }

    messages.sort_unstable_by_key(|p: &Message| p.id);
    messages
}

fn next_id(room: &str) -> usize {
    let dir = room_path(room);
    if let Ok(entries) = fs::read_dir(dir) {
        entries
            .flatten()
            .filter_map(|e| {
                e.path()
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .and_then(|s| s.parse::<usize>().ok())
            })
            .max()
            .unwrap_or(0) + 1
    } else {
        1
    }
}

fn utc_now_iso() -> String {
    let now: DateTime<Utc> = Utc::now();
    now.to_rfc3339()
}

#[get("/messages/<room>")]
fn get_messages(room: &str) -> Json<Vec<Message>> {
    Json(load_messages(room))
}

#[get("/messages", rank = 2)]
fn no_room() -> Json<Vec<Message>> {
    Json(Vec::new())
}

#[rocket::async_trait]
impl<'r> FromData<'r> for NewMessage {
    type Error = std::io::Error;

    async fn from_data(req: &'r rocket::Request<'_>, data: Data<'r>) -> Outcome<'r, Self> {
        let cfg = match req.rocket().state::<Config>() {
            Some(c) => c,
            None => {
                return Outcome::Error((
                    Status::InternalServerError,
                    std::io::Error::new(std::io::ErrorKind::Other, "Missing Config"),
                ))
            }
        };

        let limit = cfg.max_json_size.bytes();
        let buf = match data.open(limit).into_bytes().await {
            Ok(b) if b.is_complete() => b.into_inner(),
            Ok(_) => {
                return Outcome::Error((
                    Status::PayloadTooLarge,
                    std::io::Error::new(std::io::ErrorKind::Other, "Payload too large"),
                ))
            }
            Err(e) => return Outcome::Error((Status::InternalServerError, e)),
        };

        match serde_json::from_slice::<NewMessage>(&buf) {
            Ok(message) => Outcome::Success(message),
            Err(e) => Outcome::Error((
                Status::BadRequest,
                std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string()),
            )),
        }
    }
}

#[post("/messages/<room>", data = "<new_message>")]
fn create_message(
    room: &str,
    new_message: NewMessage,
    config: &State<Config>
) -> Result<Json<Message>, Status> {
    if room.len() != 16 || !room.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(Status::BadRequest);
    }

    if new_message.user.len() > config.max_user_len
        || new_message.user_iv.len() > config.max_iv_len
        || new_message.iv.len() > config.max_iv_len
        || new_message.content.len() > config.max_content_len
    {
        return Err(Status::PayloadTooLarge);
    }

    let id = next_id(room);

    let timestamp = utc_now_iso();

    let message = Message {
        id,
        room: room.to_string(),
        user: new_message.user,
        user_iv: new_message.user_iv,
        content: new_message.content,
        iv: new_message.iv,
        timestamp,
    };

    save_message_to_file(&message).map_err(|e| {
        eprintln!("save error: {}", e);
        Status::InternalServerError
    })?;

    Ok(Json(message))
}

#[get("/")]
async fn index_root() -> Option<NamedFile> {
    NamedFile::open("static/index.html").await.ok()
}

#[get("/room/<_room>")]
async fn index_room(_room: &str) -> Option<NamedFile> {
    NamedFile::open("static/index.html").await.ok()
}

#[launch]
fn rocket() -> _ {
    let cfg: Config = {
        let file = std::fs::File::open("config.json").expect("config.json not found");
        serde_json::from_reader(BufReader::new(file)).expect("Invalid config.json")
    };

    std::thread::spawn(|| {
        let interval = Duration::from_secs(60 * 60);
        loop {
            if let Err(e) = cleanup_expired_messages() {
                eprintln!("Error cleaning expired messages: {}", e);
            }
            std::thread::sleep(interval);
        }
    });

    rocket::build()
        .manage(cfg)
        .mount("/api", routes![get_messages, no_room, create_message])
        .mount("/", routes![index_root, index_room])
        .mount("/static", FileServer::from("static"))
}
