const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.md')) {
      results.push(file);
    }
  });
  return results;
}
const files = walk('.');
let updatedFiles = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.match(/postgres/i) || content.match(/SQL/g)) {
    content = content.replace(/PostgreSQL 15\+/g, 'MongoDB 6.0+');
    content = content.replace(/PostgreSQL row lock on `inventory` table/g, 'MongoDB atomic update on inventory collection');
    content = content.replace(/PostgreSQL row lock on inventory/g, 'MongoDB atomic update on inventory');
    content = content.replace(/PostgreSQL/g, 'MongoDB');
    content = content.replace(/postgres/gi, 'mongodb');
    content = content.replace(/pgPool\.query/g, 'mongoose.model');
    content = content.replace(/SQL syntax/g, 'MongoDB query syntax');
    content = content.replace(/SQL `WHERE available_quantity >= 1`/g, 'MongoDB `{ available_quantity: { $gte: 1 } }` filter');
    // Schema diagram specific replacements
    content = content.replace(/table/g, 'collection');
    content = content.replace(/Table/g, 'Collection');
    content = content.replace(/TABLE/g, 'COLLECTION');
    content = content.replace(/relational database/g, 'document database');
    content = content.replace(/Relational mapping/g, 'Document mapping');
    content = content.replace(/row-level locking/gi, 'document-level locking');
    content = content.replace(/SQL/g, 'MongoDB');
    fs.writeFileSync(file, content, 'utf8');
    updatedFiles++;
  }
});
console.log('Updated ' + updatedFiles + ' files.');
