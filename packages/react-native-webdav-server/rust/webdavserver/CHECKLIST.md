# WebDAV Atomic Implementation Checklist

This checklist breaks down all requirements into single, actionable tasks—based on RFC 4918 (WebDAV Spec), Apache mod_dav best practices, and practical interoperability/security recommendations.

---

## 1. HTTP Method Support
- [x] Implement PROPFIND method for property retrieval (with Depth header)
- [x] Implement OPTIONS for resource and collection (returns correct DAV, Allow headers)
- [ ] Implement PROPPATCH for property creation
- [ ] Implement PROPPATCH for property update
- [ ] Implement PROPPATCH for property removal
- [x] Implement MKCOL for creating new collections
- [x] Implement GET method for resource retrieval (basic HTTP server reply only, no WebDAV semantics)
- [ ] Implement GET method for collection listing
- [x] Implement HEAD method for resource metadata retrieval
- [ ] Implement POST method for resource submission
- [ ] Implement PUT for creating new resources
- [ ] Implement PUT for updating existing resources
- [x] Implement DELETE for resource deletion
- [x] Implement DELETE for collection deletion
- [ ] Implement COPY for resource duplication
- [ ] Implement COPY for collection duplication
- [ ] Implement MOVE for resource renaming/moving
- [ ] Implement MOVE for collection renaming/moving
- [ ] Implement LOCK for exclusive write lock
- [ ] Implement LOCK for shared write lock
- [ ] Implement UNLOCK method for lock removal

## 2. Resource Properties
- [x] Support live (core WebDAV) properties (read-only: getetag, getlastmodified, getcontentlength, resourcetype)
- [ ] Support dead (custom user) properties
- [ ] Store property values as XML fragments
- [x] Retrieve property values as XML fragments (for core live props only, via PROPFIND)
- [ ] Preserve XML namespace for property values
- [ ] Preserve all attributes for property values
- [ ] Preserve xml:lang for property values
- [ ] Enable discovery of all supported property names

## 3. Collections
- [ ] Support creation of hierarchical (nested) collections
- [ ] Support basic listing of collection members
- [ ] Ensure collection membership consistently reflected in URL namespace
- [ ] Support Depth:0 header for collection requests
- [ ] Support Depth:1 header for collection requests
- [ ] Support Depth:infinity header for collection requests
- [ ] Handle collection-specific response for GET
- [ ] Handle collection-specific response for PROPFIND
- [ ] Handle collection-specific response for MKCOL

## 4. Locking
- [ ] Support exclusive write locks on resources
- [ ] Support shared write locks on resources
- [ ] Support active lock discovery via LOCK
- [ ] Implement lock tokens for locked resources
- [ ] Support lock timeout and lock refresh
- [ ] Enforce lock requirements for modifying resources
- [ ] Enforce lock requirements for modifying collections
- [ ] Support lock-null resources (locked before creation)

## 5. Namespace Operations
- [ ] Implement correct COPY semantics for resources
- [ ] Implement correct COPY semantics for collections
- [ ] Respect Overwrite header on COPY (all)
- [ ] Implement correct MOVE semantics for resources
- [ ] Implement correct MOVE semantics for collections
- [ ] Respect Overwrite header on MOVE (all)
- [ ] Return 201, 204, 403, 409, 412, 423, 502 status codes for namespace operations as appropriate

## 6. HTTP Header Extensions
- [ ] Support DAV header in responses
- [ ] Support Depth header in requests and responses
- [ ] Support Destination header for COPY/MOVE
- [ ] Support If header for conditional requests
- [ ] Support Lock-Token header in locking flows
- [ ] Support Overwrite header for COPY/MOVE
- [ ] Support Timeout header for LOCK
- [ ] Return ETag headers for resources
- [ ] Perform cache validation via ETag/If-Match/If-None-Match

## 7. Status Codes & Responses
- [x] Return HTTP 207 Multi-Status for multi-object operations
- [ ] Return HTTP 422 Unprocessable Entity
- [ ] Return HTTP 423 Locked
- [ ] Return HTTP 424 Failed Dependency
- [ ] Return HTTP 507 Insufficient Storage
- [ ] Return HTTP 412 Precondition Failed
- [ ] Return HTTP 414 URI Too Long
- [x] Use 207 Multi-Status for PROPFIND
- [ ] Use 207 Multi-Status for COPY
- [ ] Use 207 Multi-Status for MOVE
- [ ] Include detailed error bodies as XML (as per spec)

## 8. XML Handling
- [ ] Ensure well-formed XML in all requests
- [ ] Ensure well-formed XML in all responses
- [ ] Correctly handle element/attribute namespacing
- [ ] Correctly handle xml:lang attributes
- [ ] Preserve all XML element structure and nesting
- [ ] Ignore xml:space but treat whitespace as significant

## 9. Security
- [ ] Require authentication for all DAV operations (Digest or Basic over SSL)
- [ ] Restrict access only to DAV-enabled paths
- [ ] Securely manage lock DB and writable directories
- [ ] Enforce limits on XML body size to mitigate DoS
- [ ] Restrict Depth:infinity to prevent DoS
- [ ] Limit upload sizes and storage per user to prevent disk fill-up
- [ ] Implement quotas and access controls as appropriate

## 10. Compliance Classes
- [ ] Implement all requirements for Class 1 compliance (basic authoring)
- [ ] Implement all requirements for Class 2 compliance (locking, collision)
- [ ] (Optional) Implement Class 3 advanced features if required

## 11. Internationalization
- [ ] Fully support xml:lang for property values
- [ ] Correctly handle UTF-8 encoding in all XML and user content

## 12. Testing & Interoperability
- [ ] Test against Windows built-in WebDAV client
- [ ] Test against macOS Finder
- [ ] Test against Linux GNOME/Nautilus
- [ ] Test against common mobile WebDAV clients
- [ ] Test against common independent WebDAV libraries
- [ ] Validate implementation with https://interop.webdav.org/ test suite
- [ ] Document any known issues, bugs, or compliance limitations

---

**Sources Referenced:**
- RFC 4918 (WebDAV Spec)
- Apache mod_dav documentation
- Interoperability test suites
