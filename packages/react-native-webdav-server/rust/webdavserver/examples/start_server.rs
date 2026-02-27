fn main() {
    let server = webdavserver::WebDavServer::new();
    server
        .start(Some(8080), String::from("/home/kiran"))
        .unwrap();
    std::thread::park();
}
