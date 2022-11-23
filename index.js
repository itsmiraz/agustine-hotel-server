const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const jwt = require('jsonwebtoken');
const app = express()
const port = 5000
var cors = require('cors');
const { query } = require('express');
require('dotenv').config()
app.use(cors())
app.use(express.json())





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.fpgnyx0.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unathorized aaaaaAccess' })
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
        const usersCollection = client.db('agustineOrders').collection('users')


        // verify admin
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            if (user?.role !== "admin") {
              res.status(403).send({ message: "Forbiddn Access" });
            }
            next();
          };

        //   stripe Api
        app.post("/create-payment-intent", async (req, res) => {
            const booking = req.body;
            // console.log('api hit',req.headers)
            const price = booking.price;
            const amount = price * 100;
      
            const paymentIntent = await stripe.paymentIntents.create({
              currency: "usd",
              amount: amount,
      
              "payment_method_types": ["card"],
            });
            res.send({
              clientSecret: paymentIntent.client_secret,
            });
          });

        //  ------------User Api -----------


        app.put("/user/:email", async (req, res) => {
            try {
                const email = req.params.email;
                


             
                // check the req
               
                const user = req.body;
                const filter = { email: email };
                const options = { upsert: true };
                const updateDoc = {
                    $set: user
                }
                const result = await usersCollection.updateOne(filter, updateDoc, options);

                // token generate 
                const token = jwt.sign(
                    { email: email },
                    process.env.ACCESS_TOKEN_SECRET,
                    { expiresIn: "1d" }
                )
                res.send({
                    status: "success",
                    message: "Token Created Successfully",
                    data: token
                })


            }
            catch (err) {
                console.log(err)
            }
        })


        app.get('/user',verifyJWT,verifyAdmin, async (req, res) => {
            const query = {}
            const result = await usersCollection.find(query).toArray()
            res.send(result)
        })


        // ------ Admin API =--------
        app.put('/user/admin/:id', verifyJWT, async (req, res) => {
            
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            if (user?.role === 'admin') {
                res.status(403).send({ message: "Forbiddn Access" });
            }

            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const option = { upsert: true };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc, option)
            res.send(result)
        })


        // Verify Admin email
        app.get("/user/admin/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === "admin" });
        });

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
        app.post('/room',verifyJWT,verifyAdmin, async (req, res) => {
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
        app.get('/bookings', verifyJWT, async (req, res) => {

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