# Lightfast Licensing

Lightfast uses a dual licensing approach to balance open source collaboration with commercial sustainability.

## Quick Summary

- **Open Source (Apache-2.0)**: Core runtime, CLI tools, and all applications except Cloud
- **Source Available (FSL-1.1)**: Cloud platform only (`apps/cloud`)

## License Details

### Apache License 2.0

The following components are licensed under **Apache License 2.0** ([view full text](LICENSE)):

#### Core Packages
- `lightfast` - Core runtime and agent framework
- `deus` - Advanced AI orchestration and automation framework

#### Applications
- `apps/www` - Marketing website
- `apps/docs` - Documentation site
- `apps/auth` - Authentication service
- `apps/chat` - Chat interface
- `apps/playground` - Interactive playground
- `apps/experimental` - Experimental features

**Why Apache 2.0?**
- Explicit patent grant protecting contributors and users
- Clear terms for commercial adoption
- Industry standard for serious open source projects
- Better legal protection than MIT

### Functional Source License 1.1 (FSL-1.1-Apache-2.0)

The following component is licensed under **FSL-1.1** ([view full text](LICENSE-FSL.md)):

- `apps/cloud` - Lightfast Cloud platform

**What FSL-1.1 Allows:**
- ✅ Internal business use
- ✅ Non-commercial education and research
- ✅ Professional services using Lightfast
- ✅ Building products **on top of** Lightfast

**What FSL-1.1 Restricts:**
- ❌ Offering a competing cloud platform service
- ❌ Substituting for Lightfast Cloud commercially

**Future License Grant:**
The Cloud platform will automatically convert to Apache 2.0 **two years** after each release.

## For Users

### Using Lightfast Runtime & CLI

If you're using Lightfast's npm packages (`lightfast`, `@lightfastai/cli`, etc.), they're all **Apache-2.0 licensed**. You can:

- Use in commercial projects
- Modify and create derivative works
- Distribute and sublicense
- Use patents granted by contributors

**Requirements:**
- Include Apache 2.0 license text
- State any changes you made

### Using Lightfast Cloud

The Cloud platform (`apps/cloud`) is **FSL-1.1 licensed**. You can:

- Run it internally for your business
- Study and modify the code
- Use it for education and research

**Restrictions:**
- Cannot offer it as a competing hosted service
- Cannot make it available to others commercially

## For Contributors

By contributing to Lightfast, you agree to license your contributions under the same license as the component you're contributing to:

- **Apache-2.0** for core packages and open source apps
- **FSL-1.1** for `apps/cloud`

We may ask you to sign a Contributor License Agreement (CLA) for significant contributions.

## For Developers Building on Lightfast

### ✅ Allowed (No License Restrictions)

- Building AI agent applications using Lightfast runtime
- Creating custom tools and workflows
- Deploying agents to your own infrastructure
- Building SaaS products that use Lightfast internally
- Forking and modifying Lightfast for your needs

### ⚠️ Restricted (FSL-1.1 Applies)

- Offering a hosted "Lightfast Cloud" alternative
- Providing Lightfast Cloud as a managed service to others
- Competing directly with our commercial offerings

**When in doubt:** If you're using Lightfast to build products, you're fine. If you're trying to compete with Lightfast Cloud itself, FSL-1.1 applies.

## File Structure

```
/LICENSE                           # Apache-2.0 (repository default, recognized by GitHub)
/LICENSE-FSL.md                   # FSL-1.1-Apache-2.0 (full text)
/LICENSING.md                     # This file

apps/cloud/LICENSE                # FSL-1.1-Apache-2.0
apps/www/LICENSE                  # Apache-2.0
apps/docs/LICENSE                 # Apache-2.0
apps/auth/LICENSE                 # Apache-2.0
apps/chat/LICENSE                 # Apache-2.0
apps/playground/LICENSE           # Apache-2.0
apps/experimental/LICENSE         # Apache-2.0

core/lightfast/LICENSE            # Apache-2.0
core/deus/LICENSE                 # Apache-2.0
```

## Third-Party Dependencies

All third-party dependencies retain their original licenses. See individual `package.json` files and `node_modules` directories for details.

## Questions?

If you have questions about licensing:

- **General inquiries**: hello@lightfast.ai
- **Commercial licensing**: hello@lightfast.ai
- **Legal questions**: legal@lightfast.ai

## Additional Resources

- [Apache License 2.0 FAQ](https://www.apache.org/foundation/license-faq.html)
- [FSL-1.1 Specification](https://fsl.software/)
- [Open Source Initiative](https://opensource.org/)

---

**Last Updated**: 2025-10-01

**Copyright**: © 2025 Lightfast Pty Ltd. All rights reserved.
