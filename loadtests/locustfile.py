"""Load test for CoreX (https://locust.io).

    pip install locust
    locust -f loadtests/locustfile.py --host http://127.0.0.1:8000
    # open http://localhost:8089, or run headless:
    locust -f loadtests/locustfile.py --host http://127.0.0.1:8000 --headless -u 200 -r 20 -t 5m --csv loadtests/result

Simulates the traffic that matters at scale:
- Visitors (most traffic): browse the property list, search with dates, open
  rooms, ask the assistant a built-in question.
- Front-desk staff (optional): dashboard, bookings, room calendar. Set
  CX_STAFF_EMAIL / CX_STAFF_PASSWORD to a staff account on a TEST environment.

Targets to agree before a customer launch (suggested):
  p95 < 400 ms for browse/search, < 800 ms for staff dashboard, 0% errors,
  at the expected peak users × 2.
Never point this at production without telling the team.
"""
import os
import random
from datetime import date, timedelta

from locust import HttpUser, between, task


def stay():
    start = date.today() + timedelta(days=random.randint(1, 60))
    return start.isoformat(), (start + timedelta(days=random.randint(1, 4))).isoformat()


class Visitor(HttpUser):
    weight = 9
    wait_time = between(1, 4)

    def on_start(self):
        r = self.client.get('/api/tenants/organizations/public_list/', name='public_list')
        self.org_ids = [o['id'] for o in (r.json() if r.ok else [])] or [1]

    @task(5)
    def browse(self):
        self.client.get('/api/tenants/organizations/public_list/', name='public_list')

    @task(4)
    def search_with_dates(self):
        ci, co = stay()
        self.client.get('/api/tenants/organizations/public_list/', params={'check_in': ci, 'check_out': co, 'guests': 2},
                        name='public_list?dates')

    @task(4)
    def open_property(self):
        org = random.choice(self.org_ids)
        ci, co = stay()
        self.client.get(f'/api/tenants/organizations/{org}/public_info/', name='public_info')
        self.client.get(f'/api/bookings/public/{org}/rooms/', params={'check_in': ci, 'check_out': co}, name='public_rooms')
        self.client.get(f'/api/bookings/public/{org}/reviews/', name='public_reviews')

    @task(1)
    def ask_assistant(self):
        self.client.post('/api/bookings/assistant/', json={'message': random.choice(
            ['rooms free tomorrow', 'cheapest stays', 'what is the cancellation policy', 'hello'])}, name='assistant')


class FrontDesk(HttpUser):
    weight = 1
    wait_time = between(3, 8)

    def on_start(self):
        email, password = os.getenv('CX_STAFF_EMAIL'), os.getenv('CX_STAFF_PASSWORD')
        self.token = None
        if email and password:
            r = self.client.post('/api/auth/login/', json={'email': email, 'password': password}, name='login')
            if r.ok and 'access' in r.json():
                self.token = r.json()['access']

    def _get(self, path, name):
        if self.token:
            self.client.get(path, headers={'Authorization': f'Bearer {self.token}'}, name=name)

    @task(3)
    def dashboard(self):
        self._get('/api/bookings/dashboard/', 'staff_dashboard')

    @task(2)
    def bookings(self):
        self._get('/api/bookings/reservations/', 'staff_bookings')

    @task(1)
    def calendar(self):
        self._get('/api/bookings/calendar/?days=14', 'room_calendar')
