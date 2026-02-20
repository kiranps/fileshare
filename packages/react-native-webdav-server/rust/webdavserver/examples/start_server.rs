fn main() {
    let server = webdavserver::WebDavServer::new(8080, String::from("/home/makhang"));
    server.start().unwrap();
    std::thread::park();
}
