use std::sync::Once;

static INIT_LOGGING: Once = Once::new();

pub fn init_logging() {
    INIT_LOGGING.call_once(|| {
        use tracing_subscriber::prelude::*;

        #[cfg(target_os = "android")]
        {
            let android_layer =
                tracing_android::layer("RustServer").expect("android tracing layer");

            let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));

            tracing_subscriber::registry()
                .with(android_layer)
                .with(env_filter)
                .with(tracing_subscriber::fmt::layer())
                .init();
        }

        #[cfg(not(target_os = "android"))]
        {
            let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
            tracing_subscriber::registry()
                .with(env_filter)
                .with(tracing_subscriber::fmt::layer())
                .init();
        }
    });
}
