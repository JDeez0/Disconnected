#!/usr/bin/env python
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')
sys.path.insert(0, '/usr/src/app')
django.setup()

from django.contrib.auth.models import User

users = User.objects.all()
print(f'Total users: {users.count()}')
print('\nFirst 30 users:')
for u in users[:30]:
    print(f'  - {u.username} (email: {u.email}, joined: {u.date_joined})')

print(f'\nLast 30 users:')
for u in users.order_by('-date_joined')[:30]:
    print(f'  - {u.username} (email: {u.email}, joined: {u.date_joined})')
