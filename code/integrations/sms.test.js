/**
 * Simple test for SMS integration
 */

const { sendSMS } = require('./sms');

async function testSms() {
  console.log('Testing SMS integration...');

  // Test with no credentials (should fall back to simulation)
  const result = await sendSMS('+1234567890', 'This is a test message');

  console.log('SMS Result:', JSON.stringify(result, null, 2));

  // Verify basic structure
  if (result.channel === 'sms' &&
      (result.status === 'simulated' || result.status === 'sent' || result.status === 'failed')) {
    console.log('✅ SMS test passed');
    return true;
  } else {
    console.log('❌ SMS test failed: Invalid response structure');
    return false;
  }
}

// Run test if called directly
if (require.main === module) {
  testSms().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(err => {
    console.error('❌ SMS test failed with error:', err);
    process.exit(1);
  });
}

module.exports = { sendSMS, testSms };