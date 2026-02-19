fn main() {
    let server = webdavserver::WebDavServer::new(8080, String::from("data"));
    server.start().unwrap();
    std::thread::park();
}
