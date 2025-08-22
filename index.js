import express from 'express';
import Redis from 'ioredis';

const app = express();
const port = process.env.PORT || 3000;

const randomInstanceId = crypto.randomUUID();

// Initialize Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
});

// Redis connection error handling
redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Middleware to parse JSON bodies
app.use(express.json());

// Define routes
app.get('/', (req, res) => {
  res.json({
    message: 'Orders service is running!',
    instanceId: randomInstanceId,
  });
});

// Orders routes
app.get('/api/orders', async (_, res) => {
  try {
    // Get all order IDs
    const orderIds = await redis.smembers('orders');
    
    // Get order details for each ID
    const orderPromises = orderIds.map(id => redis.get(`order:${id}`));
    const orderDetails = await Promise.all(orderPromises);
    
    // Parse JSON strings into objects
    const orders = orderDetails.map(order => JSON.parse(order));
    
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orderData = await redis.get(`order:${id}`);
    
    if (!orderData) {
      return res.status(404).json({ message: `Order with id ${id} not found` });
    }
    
    res.json(JSON.parse(orderData));
  } catch (error) {
    console.error(`Error fetching order ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const order = req.body;
    
    // Generate a unique ID if not provided
    if (!order.id) {
      order.id = Date.now().toString();
    }
    
    // Store order data
    await redis.set(`order:${order.id}`, JSON.stringify(order));
    
    // Add order ID to the set of all orders
    await redis.sadd('orders', order.id);
    
    res.status(201).json({ message: 'Order created', data: order });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Failed to create order' });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if order exists
    const exists = await redis.exists(`order:${id}`);
    if (!exists) {
      return res.status(404).json({ message: `Order with id ${id} not found` });
    }
    
    // Update order
    const updatedOrder = { ...req.body, id };
    await redis.set(`order:${id}`, JSON.stringify(updatedOrder));
    
    res.json({ message: `Updated order with id ${id}`, data: updatedOrder });
  } catch (error) {
    console.error(`Error updating order ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to update order' });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if order exists
    const exists = await redis.exists(`order:${id}`);
    if (!exists) {
      return res.status(404).json({ message: `Order with id ${id} not found` });
    }
    
    // Delete order
    await redis.del(`order:${id}`);
    await redis.srem('orders', id);
    
    res.json({ message: `Deleted order with id ${id}` });
  } catch (error) {
    console.error(`Error deleting order ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to delete order' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Orders service listening on port ${port}`);
});
