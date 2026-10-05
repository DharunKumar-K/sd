from locust import HttpUser, task, between, events
import json
import random

class FlashSaleUser(HttpUser):
    wait_time = between(1, 2)
    
    def on_start(self):
        # Fetch available products on start
        with self.client.get("/api/products", catch_response=True) as response:
            if response.status_code == 200:
                self.products = response.json()
            else:
                self.products = []

    @task(3)
    def browse_products(self):
        self.client.get("/api/products")

    @task(1)
    def enter_flash_sale(self):
        if not self.products:
            return
            
        # Try to buy the highly contested product
        target_product = self.products[0]
        
        with self.client.post("/api/stormshield/enter", 
                              json={"productId": target_product["id"]}, 
                              catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "queued":
                    queue_id = data.get("queueId")
                    self.poll_queue(queue_id)
                elif data.get("status") == "sold_out":
                    response.success()
            else:
                response.failure(f"Failed to enter queue: {response.status_code}")

    def poll_queue(self, queue_id):
        # Simulate a user waiting and polling their status
        for _ in range(10): # Max 10 polls
            with self.client.get(f"/api/stormshield/status/{queue_id}", catch_response=True) as response:
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "reserved":
                        # Simulate immediate payment click upon reservation
                        self.process_payment()
                        break
                    elif data.get("status") == "sold_out":
                        break
            import time
            time.sleep(1.5)

    def process_payment(self):
        # Simulate payment API if we had one
        pass
