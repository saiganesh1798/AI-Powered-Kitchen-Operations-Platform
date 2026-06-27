# ChefFlow AI - Voice-Powered Kitchen Display System 🍽️🤖

> **An AI-powered Kitchen Display System (KDS) that enables chefs to manage restaurant orders using voice commands while providing real-time analytics and intelligent order optimization.**

---

## 📌 Overview

**ChefFlow AI** is a modern **Voice-Powered Kitchen Display System** built to improve restaurant kitchen operations by eliminating unnecessary screen interactions.

Instead of manually updating order statuses, chefs can simply use voice commands such as **"Start Order"**, **"Mark Ready"**, or **"Serve Order"**, allowing them to stay focused on cooking.

The system also includes an **AI Kitchen Assistant** that groups identical menu items across multiple orders, helping chefs prepare dishes in batches and improve kitchen efficiency.

---

## ✨ Features

### 🎤 Voice-Controlled Order Management

* Start cooking orders using voice commands
* Mark orders as Ready
* Mark orders as Served
* Hands-free kitchen operation
* Real-time order status updates

---

### 🤖 AI Kitchen Assistant

* Automatically groups identical menu items
* Suggests batch preparation
* Displays total quantity across active orders
* Improves kitchen workflow during peak hours

Example:

Instead of

Table 1 → Burger

Table 3 → Burger

Table 5 → Burger

ChefFlow AI displays

Burger × 6

Tables:
T1 • T3 • T5

This helps chefs cook multiple identical items together.

---

### 📊 Live Kitchen Dashboard

Monitor

* Active Orders
* Pending Orders
* Orders Ready
* Orders Served
* Preparation Time
* SLA Status
* Kitchen Performance

---

### 📈 Analytics Dashboard

View insights including

* Peak Kitchen Hours
* Most Ordered Items
* Average Preparation Time
* SLA Breaches
* Kitchen Performance
* Daily Order Trends

---

### ⚡ Real-Time Updates

* Instant synchronization using Socket.IO
* Live dashboard updates
* No page refresh required

---

### 📜 Order History

Track

* Order Received
* Cooking Started
* Ready
* Served
* Completion Time

---

## 🛠 Tech Stack

### Frontend

* React.js
* Tailwind CSS
* JavaScript
* HTML5
* CSS3

### Backend

* Node.js
* Express.js

### Database

* MongoDB

### Real-Time Communication

* Socket.IO

### AI & Voice

* Speech Recognition API
* AI Order Aggregation



## 🎙 Voice Commands

Examples

Synonym Expansion: We added support for natural kitchen commands:

Start Cooking: "cook table 5", "start order 5", "start table 5", "prepare table 5", "begin table 5", "start cooking 5"

Mark as Ready: "ready table 5", "finish table 5", "mark ready 5", "completed table 5", "done table 5"

Serve & Archive: "serve table 5", "clear table 5", "archive table 5", "bump table 5", "clear order 5"


---

## 🚀 How It Works

1. Customer places an order.
2. Order appears instantly on the Kitchen Dashboard.
3. Chef starts cooking using voice commands.
4. Order status updates in real time.
5. AI groups identical menu items for batch preparation.
6. Chef marks the order as Ready.
7. Order is Served.
8. Analytics are updated automatically.

---

## 📂 Project Structure


ChefFlow-AI
│
├── client/
│   ├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   └── assets/
│
├── server/
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   ├── middleware/
│   └── config/
│
├── README.md
├── package.json
└── .env
```

---

## 🚀 Installation

### Clone Repository

```bash
git clone https://github.com/yourusername/ChefFlow-AI.git
```

### Navigate

```bash
cd ChefFlow-AI
```

### Install Frontend

```bash
cd client
npm install
```

### Install Backend

```bash
cd ../server
npm install
```

### Create Environment File

```
PORT=5000

MONGO_URI=your_mongodb_connection

CLIENT_URL=http://localhost:3000
```

### Start Backend

```bash
npm run dev
```

### Start Frontend

```bash
cd ../client
npm start
```

---

## 🎯 Future Improvements

* AI Kitchen Prioritization
* Predictive SLA Alerts
* Station-wise Workload Optimization
* Multi-language Voice Commands
* AI Demand Forecasting
* Inventory Prediction
* POS Integration
* Chef Performance Dashboard
* Offline Voice Recognition
* Mobile Kitchen Dashboard

---

## 💡 What I Learned

Through this project, I gained practical experience in:

* Building real-time full-stack applications
* Voice recognition integration
* AI-assisted workflow optimization
* WebSocket communication using Socket.IO
* Dashboard UI/UX design
* MongoDB database design
* REST API development

---

## 🤝 Contributing

Contributions are welcome!

If you'd like to improve ChefFlow AI:

1. Fork the repository
2. Create a new feature branch

```bash
git checkout -b feature-name
```

3. Commit your changes

```bash
git commit -m "Added new feature"
```

4. Push your branch

```bash
git push origin feature-name
```

5. Open a Pull Request

---

## 📬 Contact

**Sai**

💼 LinkedIn: www.linkedin.com/in/sai-ganesh-chikatimalla-171b90255

💻 GitHub: https://github.com/saiganesh1798

📧 Email: chikatimallasaiganesh@gmail.com

---

## ⭐ If you found this project interesting, consider giving it a Star!

It helps others discover the project and motivates me to keep building and improving real-world AI applications.

---
