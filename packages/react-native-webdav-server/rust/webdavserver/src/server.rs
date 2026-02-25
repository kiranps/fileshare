//! Glue module for server components, refactored into submodules.

mod logging;
mod middleware;
mod webdav_server;
mod routing;
mod helpers;

pub use logging::init_logging;
pub use middleware::prefix_middleware;
pub use webdav_server::WebDavServer;
pub use routing::router;

// NOTE: All prior code has been split into modules above without logic changes.
// This file only glues the modules and maintains the same public interface as before.
