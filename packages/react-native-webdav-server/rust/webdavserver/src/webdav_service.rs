use std::path::PathBuf;
use tokio_util::io::ReaderStream;

use crate::fs_repository::FsRepository;

/// Typed outcomes returned to the routing layer.
/// These carry just enough data to build HTTP responses — no axum types.

pub enum GetFileResult {
    /// Stream the file inline.
    Stream {
        content_length: u64,
        stream: ReaderStream<tokio::fs::File>,
    },
    /// Download the file as an attachment.
    Download {
        content_length: u64,
        filename: String,
        stream: ReaderStream<tokio::fs::File>,
    },
}

pub enum GetResult {
    File(GetFileResult),
    /// Download a directory as a zip.
    ZipStream {
        filename: String,
        stream: ReaderStream<tokio::io::ReadHalf<tokio::io::DuplexStream>>,
    },
    /// Attempted GET on a directory without download flag.
    IsDirectory,
    NotFound,
}

pub struct HeadResult {
    pub content_length: u64,
    pub last_modified: std::time::SystemTime,
    pub etag: String,
}

pub enum HeadOutcome {
    Ok(HeadResult),
    IsDirectory,
    NotFound,
}

pub struct PropfindEntry {
    pub href: String,
    pub metadata: std::fs::Metadata,
}

pub enum PropfindResult {
    Ok(Vec<PropfindEntry>),
    NotFound,
    UnsupportedDepth,
}

pub enum DeleteResult {
    Deleted,
    NotFound,
    PermissionDenied,
    IoError,
}

pub enum MkcolResult {
    Created,
    AlreadyExists,
    ParentNotFound,
    ParentNotDirectory,
    InvalidPath,
    BodyNotSupported,
    PermissionDenied,
    InsufficientStorage,
    IoError,
}

pub enum PutResult {
    Created,
    Updated,
    IsDirectory,
    ParentNotFound,
    ParentNotDirectory,
    InvalidPath,
    PermissionDenied,
    IoError,
}

pub enum CopyMoveResult {
    Created,
    Replaced,
    SameSourceDest,
    SourceNotFound,
    DestExistsNoOverwrite,
    ParentNotFound,
    PermissionDenied,
    IoError,
}

/// WebDAV business logic. Delegates raw I/O to `FsRepository`.
pub struct WebDavService;

impl WebDavService {
    // -----------------------------------------------------------------------
    // GET / HEAD
    // -----------------------------------------------------------------------

    pub async fn get(path: PathBuf, want_download: bool) -> GetResult {
        let meta = match FsRepository::metadata(&path).await {
            Ok(m) => m,
            Err(_) => return GetResult::NotFound,
        };

        if meta.is_file() {
            match FsRepository::read_file_stream(&path).await {
                Ok((file_meta, stream)) => {
                    let filename = path
                        .file_name()
                        .and_then(|f| f.to_str())
                        .unwrap_or("download")
                        .to_string();
                    let content_length = file_meta.len();
                    if want_download {
                        GetResult::File(GetFileResult::Download {
                            content_length,
                            filename,
                            stream,
                        })
                    } else {
                        GetResult::File(GetFileResult::Stream {
                            content_length,
                            stream,
                        })
                    }
                }
                Err(_) => GetResult::NotFound,
            }
        } else if meta.is_dir() && want_download {
            match FsRepository::zip_dir_stream(path).await {
                Ok((folder_name, stream)) => GetResult::ZipStream {
                    filename: format!("{}.zip", folder_name),
                    stream,
                },
                Err(_) => GetResult::NotFound,
            }
        } else {
            GetResult::IsDirectory
        }
    }

    pub async fn head(path: PathBuf) -> HeadOutcome {
        let meta = match FsRepository::metadata(&path).await {
            Ok(m) => m,
            Err(_) => return HeadOutcome::NotFound,
        };
        if !meta.is_file() {
            return HeadOutcome::IsDirectory;
        }
        let (modified, etag) = crate::helpers::file_timestamps(&meta);
        HeadOutcome::Ok(HeadResult {
            content_length: meta.len(),
            last_modified: modified,
            etag,
        })
    }

    // -----------------------------------------------------------------------
    // PROPFIND
    // -----------------------------------------------------------------------

    pub async fn propfind(path: PathBuf, request_path: &str, depth: &str) -> PropfindResult {
        if depth != "0" && depth != "1" {
            return PropfindResult::UnsupportedDepth;
        }

        let base_meta = match FsRepository::metadata(&path).await {
            Ok(m) => m,
            Err(_) => return PropfindResult::NotFound,
        };

        let mut entries = vec![PropfindEntry {
            href: request_path.to_string(),
            metadata: base_meta.clone(),
        }];

        if depth == "1" && base_meta.is_dir() {
            match FsRepository::read_dir(&path).await {
                Ok(children) => {
                    for child in children {
                        let href = format!(
                            "{}{}",
                            crate::helpers::ensure_trailing_slash(request_path),
                            child.name
                        );
                        entries.push(PropfindEntry {
                            href,
                            metadata: child.metadata,
                        });
                    }
                }
                Err(_) => return PropfindResult::NotFound,
            }
        }

        PropfindResult::Ok(entries)
    }

    // -----------------------------------------------------------------------
    // DELETE
    // -----------------------------------------------------------------------

    pub async fn delete(path: PathBuf) -> DeleteResult {
        let meta = match FsRepository::metadata(&path).await {
            Ok(m) => m,
            Err(_) => return DeleteResult::NotFound,
        };

        match FsRepository::delete(&path, meta.is_dir()).await {
            Ok(_) => DeleteResult::Deleted,
            Err(e) => match e.kind() {
                std::io::ErrorKind::NotFound => DeleteResult::NotFound,
                std::io::ErrorKind::PermissionDenied => DeleteResult::PermissionDenied,
                _ => DeleteResult::IoError,
            },
        }
    }

    // -----------------------------------------------------------------------
    // MKCOL
    // -----------------------------------------------------------------------

    pub async fn mkcol(path: PathBuf, body_len: usize) -> MkcolResult {
        if body_len > 0 {
            return MkcolResult::BodyNotSupported;
        }

        match FsRepository::metadata(&path).await {
            Ok(_) => return MkcolResult::AlreadyExists,
            Err(e) if e.kind() != std::io::ErrorKind::NotFound => return MkcolResult::IoError,
            _ => {}
        }

        match path.parent() {
            None => return MkcolResult::InvalidPath,
            Some(parent) => match FsRepository::metadata(parent).await {
                Ok(m) if m.is_dir() => {}
                Ok(_) => return MkcolResult::ParentNotDirectory,
                Err(_) => return MkcolResult::ParentNotFound,
            },
        }

        match FsRepository::create_dir(&path).await {
            Ok(_) => MkcolResult::Created,
            Err(e) => match e.kind() {
                std::io::ErrorKind::PermissionDenied => MkcolResult::PermissionDenied,
                std::io::ErrorKind::AlreadyExists => MkcolResult::AlreadyExists,
                std::io::ErrorKind::NotFound => MkcolResult::ParentNotFound,
                std::io::ErrorKind::Other => MkcolResult::InsufficientStorage,
                _ => MkcolResult::IoError,
            },
        }
    }

    // -----------------------------------------------------------------------
    // PUT
    // -----------------------------------------------------------------------

    pub async fn put(path: PathBuf, data: &[u8]) -> PutResult {
        let existed = match FsRepository::metadata(&path).await {
            Ok(m) => {
                if m.is_dir() {
                    return PutResult::IsDirectory;
                }
                true
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => false,
            Err(_) => return PutResult::IoError,
        };

        match path.parent() {
            None => return PutResult::InvalidPath,
            Some(parent) => match FsRepository::metadata(parent).await {
                Ok(m) if m.is_dir() => {}
                Ok(_) => return PutResult::ParentNotDirectory,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                    return PutResult::ParentNotFound;
                }
                Err(_) => return PutResult::IoError,
            },
        }

        match FsRepository::write_file(&path, data).await {
            Ok(_) => {
                if existed {
                    PutResult::Updated
                } else {
                    PutResult::Created
                }
            }
            Err(e) => match e.kind() {
                std::io::ErrorKind::PermissionDenied => PutResult::PermissionDenied,
                _ => PutResult::IoError,
            },
        }
    }

    // -----------------------------------------------------------------------
    // COPY
    // -----------------------------------------------------------------------

    pub async fn copy(src: PathBuf, dst: PathBuf, overwrite: bool, depth: &str) -> CopyMoveResult {
        if src == dst {
            return CopyMoveResult::SameSourceDest;
        }

        let src_meta = match FsRepository::metadata(&src).await {
            Ok(m) => m,
            Err(_) => return CopyMoveResult::SourceNotFound,
        };

        let dest_exists = FsRepository::metadata(&dst).await.is_ok();

        if dest_exists {
            if !overwrite {
                return CopyMoveResult::DestExistsNoOverwrite;
            }
            let dest_is_dir = FsRepository::metadata(&dst)
                .await
                .map(|m| m.is_dir())
                .unwrap_or(false);
            let _ = FsRepository::delete(&dst, dest_is_dir).await;
        }

        match dst.parent() {
            Some(parent) => match FsRepository::metadata(parent).await {
                Ok(m) if m.is_dir() => {}
                _ => return CopyMoveResult::ParentNotFound,
            },
            None => return CopyMoveResult::ParentNotFound,
        }

        let result = if src_meta.is_file() {
            FsRepository::copy_file(&src, &dst).await
        } else if depth == "0" {
            FsRepository::create_dir(&dst).await
        } else {
            FsRepository::copy_dir_recursive(&src, &dst).await
        };

        match result {
            Ok(_) => {
                if dest_exists {
                    CopyMoveResult::Replaced
                } else {
                    CopyMoveResult::Created
                }
            }
            Err(e) => match e.kind() {
                std::io::ErrorKind::PermissionDenied => CopyMoveResult::PermissionDenied,
                _ => CopyMoveResult::IoError,
            },
        }
    }

    // -----------------------------------------------------------------------
    // MOVE
    // -----------------------------------------------------------------------

    pub async fn move_resource(src: PathBuf, dst: PathBuf, overwrite: bool) -> CopyMoveResult {
        if src == dst {
            return CopyMoveResult::SameSourceDest;
        }

        let src_meta = match FsRepository::metadata(&src).await {
            Ok(m) => m,
            Err(_) => return CopyMoveResult::SourceNotFound,
        };

        let dest_exists = FsRepository::metadata(&dst).await.is_ok();

        if dest_exists {
            if !overwrite {
                return CopyMoveResult::DestExistsNoOverwrite;
            }
            let dest_is_dir = FsRepository::metadata(&dst)
                .await
                .map(|m| m.is_dir())
                .unwrap_or(false);
            let _ = FsRepository::delete(&dst, dest_is_dir).await;
        }

        match dst.parent() {
            Some(parent) => match FsRepository::metadata(parent).await {
                Ok(m) if m.is_dir() => {}
                _ => return CopyMoveResult::ParentNotFound,
            },
            None => return CopyMoveResult::ParentNotFound,
        }

        match FsRepository::rename(&src, &dst).await {
            Ok(_) => {
                if dest_exists {
                    CopyMoveResult::Replaced
                } else {
                    CopyMoveResult::Created
                }
            }
            Err(e) => {
                // EXDEV (18) = cross-device rename; fall back to copy + delete
                if e.raw_os_error() == Some(18) {
                    let copy_result = if src_meta.is_file() {
                        FsRepository::copy_file(&src, &dst).await
                    } else {
                        FsRepository::copy_dir_recursive(&src, &dst).await
                    };

                    match copy_result {
                        Ok(_) => {
                            let _ = FsRepository::delete(&src, src_meta.is_dir()).await;
                            if dest_exists {
                                CopyMoveResult::Replaced
                            } else {
                                CopyMoveResult::Created
                            }
                        }
                        Err(ce) => match ce.kind() {
                            std::io::ErrorKind::PermissionDenied => {
                                CopyMoveResult::PermissionDenied
                            }
                            _ => CopyMoveResult::IoError,
                        },
                    }
                } else {
                    match e.kind() {
                        std::io::ErrorKind::PermissionDenied => CopyMoveResult::PermissionDenied,
                        _ => CopyMoveResult::IoError,
                    }
                }
            }
        }
    }
}
