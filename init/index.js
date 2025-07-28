if(process.env.NODE_ENV != "production"){
    require("dotenv").config({ path: __dirname + '/../.env' });

}


const mongoose = require("mongoose");
const initdata = require("./data.js");
const listing = require("../Models/listing.js");
 const DbUrl=process.env.AtLas_DB_URL;
main()
  .then(() => {
    console.log("Connection Successful TO DB");
  })
  .catch((err) => console.log(err));

 

  async function main() {
    await mongoose.connect(DbUrl);  // atlas url 
  }

// async function main() {
//   await mongoose.connect("mongodb://127.0.0.1:27017/wanderlust");
// }

// Categories array
const categories = [
  "Trending", "Rooms", "Iconic Cities", "Mountains", "Castles",
  "Pools", "Camping", "Farms", "Arctic", "Treehouse", "Lakes"
];

// Function to assign category based on index (alternate pattern)
function assignCategoryByIndex(index) {
  return categories[index % categories.length];
}

const initdb = async () => {
  await listing.deleteMany({});

  const processedData = initdata.data.map((item, index) => {
    return {
      ...item,
      image: item.image && item.image.url && item.image.filename
        ? { url: item.image.url, filename: item.image.filename }
        : null,
      owner: "688644b497897bc3942b4721",
      category: assignCategoryByIndex(index),
    };
  });

  await listing.insertMany(processedData);
  console.log("Data was initialized");
};

initdb();
