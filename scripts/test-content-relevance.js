const { test } = require('./test-tutoring-content');
// Pure fixture checks: no current CSV replacement, full build, or output writes.
if (require.main === module) test();
module.exports = { test };
