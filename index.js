const express = require( 'express' );
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe =require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

//middleware
app.use(cors({
  origin: [
      'https://wedding-door.web.app',
      'http://localhost:5173'
  ],
  credentials: true
}));
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mnxfzlt.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //await client.connect();


    const userCollection = client.db("weddingDB").collection("users");
    const bioDataCollection = client.db("weddingDB").collection("bioData");
    const reviewCollection = client.db("weddingDB").collection("reviews");
    const favouriteCollection = client.db("weddingDB").collection("favourites");
    const reqContactCollection = client.db("weddingDB").collection("reqContacts");
    const reqPremiumCollection = client.db("weddingDB").collection("reqPremium");
    const paymentCollection = client.db("weddingDB").collection("payments");

    // jwt api
    app.post('/jwt', async(req, res) =>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '2h'});
      res.send({token});
    })

    //middlewares
    const verifyToken = (req, res, next) =>{
      //console.log(req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message: 'unauthorized access'});
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
        if(err){
          return res.status(401).send({message: 'forbidden access'})
        }
        req.decoded = decoded;
        next();
      })
      //
    }

    const verifyAdmin = async( req, res, next) =>{
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if(!isAdmin){
        return res.status(403).send({message: 'forbidden access'});
      }
      next();
    }

    //Users collection
    app.get('/users', verifyToken, verifyAdmin, async(req, res) =>{
      //console.log(req.headers)
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    app.get('/users/admin/:email', verifyToken, async(req, res) =>{
      const email = req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      const query = {email: email};
      const user = await userCollection.findOne(query);
      let admin = false;
      if(user){
        admin = user?.role === 'admin';
      }
      //console.log(admin)
      res.send({admin});
    })

    app.get('/users/premium/:email', verifyToken, async(req, res) =>{
      const email = req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      const query = {email: email};
      const user = await userCollection.findOne(query);
      let premium = false;
      if(user){
        premium = user?.type === 'premium';
      }
      //console.log(admin)
      res.send({premium});
    })

    app.post('/users', async(req, res) =>{
      const user = req.body;
      const query = {email: user.email};
      const existingUser = await userCollection.findOne(query);
      if(existingUser){
        return res.send({ message: 'User already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(query);
      res.send(result);
    })

    app.delete('/users/:id', verifyToken, verifyAdmin, async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async(req, res) =>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc ={
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.patch('/users/premium/:id', verifyToken, verifyAdmin, async(req, res) =>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc ={
        $set: {
          type: 'premium'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    //Bio Data collection
    app.get('/bioData/all', async(req, res) =>{
      const result = await bioDataCollection.find().toArray();
      res.send(result);
    })

    app.get('/bioData', async(req, res) =>{
      const query = {};

      if (req.query.age && !isNaN(req.query.age)) {
        query.age = { $lte: parseInt(req.query.age) };
      }

      if (req.query.gender) {
        query.gender = { $in: [req.query.gender] };
      }

      if (req.query.division) {
        query.permanentDiv = { $in: [req.query.division] };
      }
  
      const result = await bioDataCollection.find(query).toArray();
      //const result = await bioDataCollection.find({ "age": { $lt: req.query.age }, "gender": { $in: req.query.gender }, "division": { $in: req.query.division} }).toArray();
      res.send(result);
    })


    app.get('/bioData/me', verifyToken, async(req, res) =>{
      const email = req.decoded.email;
      const query = {"email": email};
      const result = await bioDataCollection.findOne(query);
      res.send(result);
    })
    app.get('/bioData/:id', async(req, res) =>{
      const id= req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await bioDataCollection.findOne(query);
      res.send(result);
    })
    app.get('/bioData/email/:email', async(req, res) =>{
      const email = req.params.email;
      const query = {"email": email};
      const result = await bioDataCollection.findOne(query);
      res.send(result);
    })

    app.patch('/bioData/premium/:id', verifyToken, verifyAdmin, async(req, res) =>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc ={
        $set: {
          type: 'premium',
        }
      }
      const result = await bioDataCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.patch('/bioData/contact/:id', verifyToken, verifyAdmin, async(req, res) =>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc ={
        $set: {
          status: 'approved',
        }
      }
      const result = await bioDataCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.post('/bioData', verifyToken, async(req, res) =>{
      const item = req.body;
      const email = req.body.email;

      const lastBiodata = await bioDataCollection.findOne(
        { email: email },
        { sort: { biodataId: -1 } }
      );
  
      const lastBiodataId = lastBiodata ? lastBiodata.biodataId : 0;

      const newBiodataId = lastBiodataId + 1;
  
      item.biodataId = newBiodataId;

      const result = await bioDataCollection.insertOne(item);
      res.send(result);
    })

    app.patch('/bioData/:id', verifyToken, async(req, res) =>{
      const item = req.body;
      const email = req.decoded.email;
      const filter = {email: email};
      const updatedDoc ={
        $set: {
          gender: item.gender,
          name: item.name,
          image: item.image,
          dob: item.dob,
          height: item.height,
          weight: item.weight,
          age: item.age,
          occupation: item.occupation,
          race: item.race,
          fathersName: item.fathersName,
          mothersName: item.mothersName,
          permanentDiv: item.permanentDiv,
          presentDiv: item.presentDiv,
          partnerAge: item.partnerAge,
          partnerHeight: item.partnerHeight,
          partnerWeight: item.partnerWeight,
          email: item.email,
          mobile: item.mobile
        }
      }
      const result = await bioDataCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.get('/reviews', async(req, res) =>{
        const result = await reviewCollection.find().toArray();
        res.send(result);
    })

    app.post('/reqPremium', verifyToken, async(req, res) =>{
      const reqItem = req.body;
      const result = await reqPremiumCollection.insertOne(reqItem);
      res.send(result);
    })

    //Favourites collection
    app.get('/favourites', async(req, res) =>{
      const email = req.query.email;
      const query = {email: email};
      const result = await favouriteCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/favourites', async(req, res) =>{
      const favouriteItem = req.body;
      const result = await favouriteCollection.insertOne(favouriteItem);
      res.send(result);
    })

    app.delete('/favourites/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await favouriteCollection.deleteOne(query);
      res.send(result);
    })

    //Payment api
    app.post('/create-payment-intent', async(req, res) =>{
      const { price } = req.body;
      const amount = parseInt(price * 100);

      if(amount){
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
        });
  
        res.send({
          clientSecret: paymentIntent.client_secret
        })
      }      
    })

    app.get('/payments/:email', verifyToken, async(req, res) =>{
      const query = {email: req.params.email};
      if(req.params.email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/reqContacts', verifyToken, async(req, res) =>{
      const payment = req.body;
      if(payment){
        const paymentResult = await reqContactCollection.insertOne(payment);
        //console.log('payment info', payment)
        // const query = {
        //   _id: {
        //     $in: payment.bioDataIds.map(id => new ObjectId(id))
        //   }
        // };
        // const deleteResult = await reqContactCollection.deleteMany(query);
        res.send({paymentResult});
      }
    })

    app.get('/reqContacts', async(req, res) =>{
      const email = req.query.email;
      const query = {email: email};
      const result = await reqContactCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/requestContacts', async(req, res) =>{
      const result = await reqContactCollection.find().toArray();
      res.send(result);
    })

    app.patch('/requestContacts/:id', verifyToken, verifyAdmin, async(req, res) =>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc ={
        $set: {
          status: 'approved',
        }
      }
      const result = await reqContactCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.delete('/reqContacts/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await reqContactCollection.deleteOne(query);
      res.send(result);
    })

    app.get('/requestPremium', async(req, res) =>{
      const result = await reqPremiumCollection.find().toArray();
      res.send(result);
    })

    app.patch('/requestPremium/:id', verifyToken, verifyAdmin, async(req, res) =>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc ={
        $set: {
          status: 'premium',
        }
      }
      const result = await reqPremiumCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.post('/reviews', async(req, res) =>{
      const review = req.body;
      //console.log(newFood)
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    })
    // stats or analytics
    app.get('/admin-stats', verifyToken, verifyAdmin, async(req, res) =>{
      const users = await userCollection.estimatedDocumentCount();
      const bioDataItems = await bioDataCollection.estimatedDocumentCount();

      const pipeline = [
        {
          $group: {
            _id: "$gender",
            count: { $sum: 1 }
          }
        }
      ];     
      const genderCounts = await bioDataCollection.aggregate(pipeline).toArray();
      const maleCount = genderCounts.find(item => item._id === "male")?.count || 0;
      const femaleCount = genderCounts.find(item => item._id === "female")?.count || 0;

      const typePipeline = [
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 }
          }
        }
      ];
      const typeCounts = await bioDataCollection.aggregate(typePipeline).toArray();
      const premiumCount = typeCounts.find(item => item._id === "premium")?.count || 0;

      // const reqContacts = await reqContactCollection.find().toArray();
      // const revenue = reqContacts.reduce( (total, payment) => total + payment.price, 0);
      const result = await reqContactCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: '$price'
            }
          }
        }
      ]).toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        users,
        bioDataItems,
        maleCount,
        femaleCount,
        premiumCount,
        revenue
      });
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('server running')
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})