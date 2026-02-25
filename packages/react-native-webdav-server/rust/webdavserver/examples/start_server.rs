fn main() {
    let server = webdavserver::WebDavServer::new(8080, String::from("/home/kiran"));
    server.start().unwrap();
    std::thread::park();
}
