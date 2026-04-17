use std::fs::Metadata;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use tokio::io::AsyncWriteExt;
use tokio_util::io::{ReaderStream, SyncIoBridge};

/// Low-level async filesystem operations.
/// No HTTP types, no business logic — just raw I/O.
pub struct FsRepository;

#[derive(Debug)]
pub struct EntryInfo {
    pub name: String,
    pub metadata: Metadata,
}

impl FsRepository {
    /// Return metadata for `path`, or `None` if it does not exist.
    pub async fn metadata(path: &Path) -> std::io::Result<Metadata> {
        tokio::fs::metadata(path).await
    }

    /// Read directory entries (one level deep).
    pub async fn read_dir(path: &Path) -> std::io::Result<Vec<EntryInfo>> {
        let mut rd = tokio::fs::read_dir(path).await?;
        let mut entries = Vec::new();
        while let Some(entry) = rd.next_entry().await? {
            let meta = entry.metadata().await?;
            let name = entry.file_name().to_string_lossy().into_owned();
            entries.push(EntryInfo { name, metadata: meta });
        }
        Ok(entries)
    }

    /// Read a file and return a streaming body.
    pub async fn read_file_stream(path: &Path) -> std::io::Result<(Metadata, ReaderStream<tokio::fs::File>)> {
        let file = tokio::fs::File::open(path).await?;
        let metadata = file.metadata().await?;
        Ok((metadata, ReaderStream::new(file)))
    }

    /// Write bytes to `path`, creating or truncating it.
    pub async fn write_file(path: &Path, data: &[u8]) -> std::io::Result<()> {
        let mut file = tokio::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(path)
            .await?;
        file.write_all(data).await
    }

    /// Delete a file or directory recursively.
    pub async fn delete(path: &Path, is_dir: bool) -> std::io::Result<()> {
        if is_dir {
            tokio::fs::remove_dir_all(path).await
        } else {
            tokio::fs::remove_file(path).await
        }
    }

    /// Create a directory (non-recursive — only creates the final component).
    pub async fn create_dir(path: &Path) -> std::io::Result<()> {
        tokio::fs::create_dir(path).await
    }

    /// Copy a file.
    pub async fn copy_file(src: &Path, dst: &Path) -> std::io::Result<()> {
        tokio::fs::copy(src, dst).await.map(|_| ())
    }

    /// Copy a directory tree recursively.
    pub fn copy_dir_recursive<'a>(
        src: &'a Path,
        dst: &'a Path,
    ) -> Pin<Box<dyn Future<Output = std::io::Result<()>> + Send + 'a>> {
        Box::pin(async move {
            tokio::fs::create_dir(dst).await?;
            let mut entries = tokio::fs::read_dir(src).await?;
            while let Some(entry) = entries.next_entry().await? {
                let ft = entry.file_type().await?;
                let new_dst = dst.join(entry.file_name());
                if ft.is_dir() {
                    Self::copy_dir_recursive(&entry.path(), &new_dst).await?;
                } else {
                    tokio::fs::copy(entry.path(), new_dst).await?;
                }
            }
            Ok(())
        })
    }

    /// Rename (move) `src` to `dst`.
    pub async fn rename(src: &Path, dst: &Path) -> std::io::Result<()> {
        tokio::fs::rename(src, dst).await
    }

    /// Stream a zip archive of a directory.
    /// Returns `(folder_name, ReaderStream)` ready to pipe into an HTTP body.
    pub async fn zip_dir_stream(
        path: PathBuf,
    ) -> std::io::Result<(String, ReaderStream<tokio::io::ReadHalf<tokio::io::DuplexStream>>)> {
        let folder_name = path
            .file_name()
            .and_then(|f| f.to_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "download".to_string());

        let (tx, rx) = tokio::io::duplex(1024 * 1024);
        let (rx_read, _rx_write) = tokio::io::split(rx);

        let zip_root = path.clone();
        tokio::task::spawn_blocking(move || {
            use std::io::Read as _;
            use walkdir::WalkDir;
            use zip::write::FileOptions;

            let writer = SyncIoBridge::new(tx);
            let mut zip = zip::ZipWriter::new_stream(writer);
            let options: FileOptions<'_, ()> =
                FileOptions::default().compression_method(zip::CompressionMethod::Stored);

            for entry in WalkDir::new(&zip_root).into_iter().flatten() {
                let p = entry.path();
                let name = p.strip_prefix(&zip_root).unwrap();
                if p.is_file() {
                    zip.start_file(name.to_string_lossy(), options).ok();
                    if let Ok(mut f) = std::fs::File::open(p) {
                        let mut buf = Vec::new();
                        let _ = f.read_to_end(&mut buf);
                        let _ = std::io::Write::write_all(&mut zip, &buf);
                    }
                } else if !name.as_os_str().is_empty() {
                    let _ = zip.add_directory(name.to_string_lossy(), options);
                }
            }
            let _ = zip.finish();
        });

        Ok((folder_name, ReaderStream::new(rx_read)))
    }
}
