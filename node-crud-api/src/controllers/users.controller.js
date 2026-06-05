let users = [
  { id: 1, name: 'Giorgio' }
];

// GET /users
exports.getAll = (req, res) => {
  return res.json(users);
};

// GET /users/:id
exports.getById = (req, res) => {
  const user = users.find(u => u.id == req.params.id);

  if (!user) {
    return res.status(404).json({
      message: 'User not found'
    });
  }

  return res.json(user);
};

// POST /users
exports.create = (req, res) => {
  const { name } = req.body;

  const newUser = {
    id: users.length + 1,
    name
  };

  users.push(newUser);

  return res.status(201).json(newUser);
};

// PUT /users/:id
exports.update = (req, res) => {
  const user = users.find(u => u.id == req.params.id);

  if (!user) {
    return res.status(404).json({
      message: 'User not found'
    });
  }

  user.name = req.body.name;

  return res.json(user);
};

// DELETE /users/:id
exports.remove = (req, res) => {
  users = users.filter(u => u.id != req.params.id);

  return res.status(204).send();
};
``