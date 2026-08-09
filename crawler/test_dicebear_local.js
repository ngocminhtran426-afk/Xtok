const { createAvatar } = require('@dicebear/core');
const { clay } = require('@dicebear/collection');

const avatar = createAvatar(clay, {
  seed: 'Felix',
});

console.log(avatar.toDataUri());
