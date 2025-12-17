# Elemental Website Documentation

This folder contains all documentation for the Elemental Website CMS project.

## 📚 Documentation Structure

### Core Documentation
- **[BASELINE.md](./BASELINE.md)** - Clean baseline state and setup guide (START HERE)
- **[RECOVERY.md](./RECOVERY.md)** - Database recovery procedures
- **[ADMIN_FEATURES.md](./ADMIN_FEATURES.md)** - Admin panel features and usage

### Deployment Documentation
See [deployment/](./deployment/) folder:
- **[DEPLOYMENT.md](./deployment/DEPLOYMENT.md)** - General deployment guide
- **[PRODUCTION_DEPLOYMENT.md](./deployment/PRODUCTION_DEPLOYMENT.md)** - Production-specific deployment
- **[PRODUCTION_DB_MIGRATION.md](./deployment/PRODUCTION_DB_MIGRATION.md)** - Database migration guide
- **[DEPLOYMENT_SUMMARY.md](./deployment/DEPLOYMENT_SUMMARY.md)** - Deployment summary

### Development Guides
- **[ADMIN_STRUCTURE.md](./ADMIN_STRUCTURE.md)** - Admin panel structure
- **[BUILD_FIX.md](./BUILD_FIX.md)** - Build troubleshooting
- **[CODE_REVIEW_IMPROVEMENTS.md](./CODE_REVIEW_IMPROVEMENTS.md)** - Code quality improvements
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Feature implementation details
- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Migration patterns and practices
- **[QUICK_DEPLOY.md](./QUICK_DEPLOY.md)** - Quick deployment reference
- **[TEST_LOCALLY.md](./TEST_LOCALLY.md)** - Local testing guide

### Historical Documentation
See [archive/](./archive/) folder - contains troubleshooting docs from the initial setup and migration process.

## 🚀 Quick Start

1. **New to the project?** → Read [BASELINE.md](./BASELINE.md)
2. **Setting up locally?** → Read [TEST_LOCALLY.md](./TEST_LOCALLY.md)
3. **Deploying to production?** → Read [deployment/PRODUCTION_DEPLOYMENT.md](./deployment/PRODUCTION_DEPLOYMENT.md)
4. **Database issues?** → Read [RECOVERY.md](./RECOVERY.md)
5. **Admin panel questions?** → Read [ADMIN_FEATURES.md](./ADMIN_FEATURES.md)

## 📁 Related Documentation

- **Migrations**: See `/migrations/README.md` for database migration docs
- **Scripts**: See `/scripts/migrations/README.md` for deprecated migration scripts
- **Main README**: See `/README.md` for project overview

## 🗂️ Organization

```
docs/
├── README.md                    ← You are here
├── BASELINE.md                  ← START HERE - Clean baseline guide
├── RECOVERY.md                  ← Database recovery
├── ADMIN_FEATURES.md            ← Admin panel features
├── ADMIN_STRUCTURE.md           ← Admin panel structure
├── deployment/                  ← All deployment-related docs
│   ├── DEPLOYMENT.md
│   ├── PRODUCTION_DEPLOYMENT.md
│   ├── PRODUCTION_DB_MIGRATION.md
│   └── DEPLOYMENT_SUMMARY.md
└── archive/                     ← Historical/troubleshooting docs
    ├── ADMIN_PANEL_AUDIT.md
    ├── COMPREHENSIVE_AUDIT.md
    ├── FIX_PRODUCTION_DB.md
    └── FIX_SCHEMA_MIGRATION.md
```
