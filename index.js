const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const jwt = require('jsonwebtoken');
const app = express()
const port = 5000
var cors = require('cors')
require('dotenv').config()
app.use(cors())
app.use(express.json())





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.fpgnyx0.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unathorized Access' })
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Hala CHor' })
        }
        req.decoded = decoded;
        next()
    })

}


async function run() {

    try {
        const roomCollection = client.db('agustineRooms').collection('rooms')
        const orderCollection = client.db('agustineOrders').collection('orders')


        // JWT Token API


        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10h' })
            res.send({ token })
        })


        // ----------Client API's-----------
        app.get('/room', async (req, res) => {
            const page = req.query.page;
            const size = parseInt(req.query.size)
            const query = {};
            const cursor = roomCollection.find(query);
            const rooms = await cursor.skip(page * size).limit(size).toArray()
            const count = await roomCollection.estimatedDocumentCount()
            res.send({ count, rooms })
        })

        app.get('/room/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const room = await roomCollection.findOne(query)
            res.send(room)
        })

        //------------ Admin API's--------------

        // create room
        app.post('/room', async (req, res) => {
            const room = req.body;

            const result = await roomCollection.insertOne(room);

            res.send(result)
        })

        // Update Room
        app.put('/room/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const room = req.body;
            const option = { upsert: true };
            const updateRoom = {
                $set: {
                    name: room.name,
                    price: room.price,
                    image: room.image,
                    capacity: room.capacity,
                    des: room.des,

                }
            }
            const result = await roomCollection.updateOne(filter, updateRoom, option)

            res.send(result)

        })
        // Delete Room
        app.delete('/room/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await roomCollection.deleteOne(query);

            res.send(result)
        })

        // -----------Order Api----------

        // ---- post book
        app.post('/orders', async (req, res) => {
            const body = req.body;
            const result = await orderCollection.insertOne(body)
            res.send(result)
        })

        //  ---- get booking by email
        app.get('/orders', verifyJWT, async (req, res) => {

            const decoded = req.decoded;
            if (decoded.email !== req.query.email) {
                return res.status(403).send({ message: 'Forbidend access' })
            }

            let query = {}
            if (req.query.email) {
                query = {
                    email: req.query.email
                }
            }

            const cursor = orderCollection.find(query);
            const orders = await cursor.toArray()

            res.send(orders)

        })

        // --- cancel booking

        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;

            const query = { _id: ObjectId(id) }
            const result = await orderCollection.deleteOne(query);

            res.send(result)
        })


    }
    finally {

    }

}

run().catch(error => console.log(error))


app.get('/', (req, res) => {
    res.send('Hello World!')
})


app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})