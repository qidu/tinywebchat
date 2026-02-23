# Changelog

All notable changes to TinyWebChat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of TinyWebChat plugin
- Dual-mode operation (CLI standalone & Plugin integrated)
- Session management with token authentication
- Two processing modes: queue and batch
- Real-time SSE events support
- Message history with pagination
- CORS support with configurable origins
- Rate limiting per session
- Offline message queueing
- WeChat Mini-Program SDK support
- Comprehensive test suite
- Deployment documentation
- Health check endpoint

### Features
- **CLI Mode:** Spawns OpenClaw agent processes for standalone operation
- **Plugin Mode:** Integrates with OpenClaw's internal API for seamless operation
- **Session Management:** Secure token-based authentication with automatic cleanup
- **Message Processing:** Queue mode (sequential) and Batch mode (grouped context)
- **Real-time Updates:** Server-Sent Events (SSE) for live message delivery
- **Cross-platform:** H5 browser and WeChat Mini-Program support
- **Scalable:** Configurable for single instance or load-balanced deployments

### Technical Details
- Built with TypeScript for type safety
- ES Modules for modern JavaScript
- Comprehensive unit and integration tests
- Proper error handling and logging
- Security-focused design with rate limiting and input validation
- Session cleanup to prevent memory leaks
- Configurable timeouts and limits

### Deployment Options
- Local development setup
- Standalone server deployment
- OpenClaw plugin integration
- Docker container deployment
- Reverse proxy configurations (Nginx, Caddy)
- Horizontal scaling support

## [1.0.0] - 2026-02-23

### First Public Release

**Initial release includes:**

#### Core Features
- ✅ Dual-mode operation (CLI & Plugin)
- ✅ Session management with secure tokens
- ✅ Real-time messaging via SSE
- ✅ Message history and pagination
- ✅ Rate limiting and CORS support

#### Processing Modes
- ✅ Queue mode: Sequential message processing
- ✅ Batch mode: Grouped context processing

#### Client Support
- ✅ H5 browser web interface
- ✅ WeChat Mini-Program SDK
- ✅ Test chat interface included

#### Integration
- ✅ OpenClaw plugin manifest
- ✅ Configuration schema
- ✅ HTTP API endpoints
- ✅ Health monitoring

#### Security
- ✅ Secure token generation
- ✅ Input validation
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Session timeout enforcement

#### Documentation
- ✅ README with architecture overview
- ✅ API documentation
- ✅ Configuration examples
- ✅ Deployment guide
- ✅ Testing instructions

#### Testing
- ✅ Unit tests for core functionality
- ✅ Integration tests
- ✅ Gateway and HTTP handler tests

### Known Limitations
- In-memory session storage (extendable to Redis/DB)
- Basic error responses (will be enhanced in future releases)
- No built-in user authentication (session-based only)

### Upgrade Notes
This is the initial release. No upgrade path needed.

### Migration Guide
N/A - First release

## Future Plans

### Planned for 1.1.0
- [ ] Persistent session storage (Redis support)
- [ ] Enhanced error handling with detailed codes
- [ ] WebSocket support as alternative to SSE
- [ ] File upload support
- [ ] User authentication system
- [ ] Admin dashboard
- [ ] Advanced metrics and monitoring

### Planned for 1.2.0
- [ ] Multi-language support
- [ ] Customizable UI themes
- [ ] Plugin system for extensions
- [ ] Advanced rate limiting strategies
- [ ] Distributed session management
- [ ] Load balancing optimizations

### Long-term Roadmap
- [ ] Mobile app SDKs
- [ ] Voice message support
- [ ] Video call integration
- [ ] End-to-end encryption
- [ ] Federation support
- [ ] Marketplace for plugins and themes

## Security

### Reporting Security Issues

If you discover a security vulnerability in TinyWebChat, please report it responsibly:

1. **Do not** disclose the vulnerability publicly
2. **Do not** create a GitHub issue for security vulnerabilities
3. **Email** security@tinywebchat.org with details
4. **Include** steps to reproduce the vulnerability
5. **Wait** for our security team to respond

### Security Features in 1.0.0
- Secure token generation using crypto.randomBytes
- Input validation and sanitization
- Rate limiting to prevent abuse
- CORS configuration for cross-origin protection
- Session timeout enforcement
- No sensitive data in logs

### Security Best Practices
1. Always use HTTPS in production
2. Configure CORS origins appropriately
3. Set appropriate rate limits for your use case
4. Regularly update dependencies
5. Monitor logs for suspicious activity
6. Use a reverse proxy with SSL termination
7. Implement proper firewall rules

## Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) file for details.

## License

TinyWebChat is released under the MIT License. See [LICENSE](LICENSE) for details.