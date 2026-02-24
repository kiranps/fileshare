use quick_xml::de::from_str;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct Multistatus {
    #[serde(rename = "response")]
    responses: Vec<Response>,
}

#[derive(Debug, Deserialize)]
struct Response {
    href: String,
    propstat: PropStat,
}

#[derive(Debug, Deserialize)]
struct PropStat {
    prop: Prop,
    status: String,
}

#[derive(Debug, Deserialize)]
struct Prop {
    resourcetype: ResourceType,
    getcontentlength: Option<u64>,
    getlastmodified: Option<String>,
    getetag: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ResourceType {
    // <collection/> becomes Some(())
    collection: Option<Empty>,
}

#[derive(Debug, Deserialize)]
struct Empty {}

// ----------- PARSE FUNCTION ------------

pub fn parse_webdav_multistatus(xml: &str) -> Result<Vec<WebDavItem>, Box<dyn std::error::Error>> {
    let parsed: Multistatus = from_str(xml)?;

    let items = parsed
        .responses
        .into_iter()
        .map(|r| WebDavItem {
            path: r.href,
            is_collection: r.propstat.prop.resourcetype.collection.is_some(),
            content_length: r.propstat.prop.getcontentlength.unwrap_or(0),
            last_modified: r.propstat.prop.getlastmodified,
            etag: r.propstat.prop.getetag,
        })
        .collect();

    Ok(items)
}

// Clean domain model (better than exposing raw XML structs)
#[derive(Debug)]
pub struct WebDavItem {
    pub path: String,
    pub is_collection: bool,
    pub content_length: u64,
    pub last_modified: Option<String>,
    pub etag: Option<String>,
}
