# SPARC Template: API Development

**API Name**: [Enter API name]
**Version**: [v1.0.0]
**Developer**: [Your name]
**Date**: [YYYY-MM-DD]

---

## Phase 1: Specification

### API Purpose
[What does this API do?]

### Endpoints

#### Endpoint 1: [METHOD] /path
- **Description**: [What it does]
- **Request**: [Body/params]
- **Response**: [Format]
- **Status Codes**: 200, 400, 401, 500

#### Endpoint 2: [METHOD] /path
[Repeat for each endpoint]

### Authentication
[Method: JWT, API Key, OAuth, etc.]

### Rate Limiting
[Limits and throttling strategy]

---

## Phase 2: Pseudocode

### Endpoint Logic
```
ENDPOINT: POST /api/v1/resource

FUNCTION handle_post(request):
  VALIDATE auth
  VALIDATE input
  PROCESS request
  RETURN response
END
```

---

## Phase 3: Architecture

### API Structure
```
/api/v1/
├── /resource
│   ├── GET    /resource        List all
│   ├── GET    /resource/:id    Get one
│   ├── POST   /resource        Create
│   ├── PUT    /resource/:id    Update
│   └── DELETE /resource/:id    Delete
```

### Data Models
```javascript
{
  id: string,
  name: string,
  created_at: timestamp
}
```

---

## Phase 4: Refinement

### Implementation
- [ ] Endpoints implemented
- [ ] Validation added
- [ ] Tests written (80%+)
- [ ] Documentation generated (OpenAPI/Swagger)
- [ ] Security scan passed

---

## Phase 5: Completion

### Deployment
- [ ] API deployed
- [ ] Documentation published
- [ ] Client SDKs generated
- [ ] Monitoring active

**API Status**: ⏳ Design / 🔄 Development / ✅ Production
