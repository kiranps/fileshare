//! Glue module for server components, refactored into submodules.

mod helpers;
mod logging;
mod middleware;
mod routing;
mod webdav_server;

pub use webdav_server::{StartOptions, WebDavServer};

// NOTE: All prior code has been split into modules above without logic changes.
// This file only glues the modules and maintains the same public interface as before.
