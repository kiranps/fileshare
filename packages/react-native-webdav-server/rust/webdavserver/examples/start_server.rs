fn main() {
    let server = webdavserver::WebDavServer::new();
    server
        .start(webdavserver::StartOptions {
            port: Some(8080),
            base_path: String::from("/home/kiran"),
            auth: None,
        })
        .unwrap();
    std::thread::park();
}
