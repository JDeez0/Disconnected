#!/usr/bin/env python
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')
sys.path.insert(0, '/usr/src/app')
django.setup()

from django.contrib.auth.models import User

# Keep these real users
REAL_USERS = ['admin', 'jasper', 'jd2']

print(f'Total users before cleanup: {User.objects.count()}')

# Find machine-generated users (with @example.com email or created during bulk import)
machine_generated = User.objects.filter(
    email__endswith='@example.com'
).exclude(username__in=REAL_USERS)

print(f'Found {machine_generated.count()} machine-generated users')
print('\nSample of users to delete:')
for u in machine_generated[:5]:
    print(f'  - {u.username} (email: {u.email})')

# Confirm deletion
response = input(f'\nDelete {machine_generated.count()} machine-generated users? (yes/no): ')
if response.lower() == 'yes':
    count = machine_generated.delete()[0]
    print(f'\nDeleted {count} machine-generated users')
    print(f'Total users after cleanup: {User.objects.count()}')
    print(f'\nRemaining users:')
    for u in User.objects.all():
        print(f'  - {u.username} (email: {u.email}, joined: {u.date_joined})')
else:
    print('Cancelled. No users were deleted.')
