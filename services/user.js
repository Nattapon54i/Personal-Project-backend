const jwt = require('jsonwebtoken');
const passport = require('passport');
const config = require('../config/passport/passport');
const bcrypt = require('bcryptjs')

module.exports = (app, db) => {
  app.get("/users", (req, res) => {
    db.user
      .findAll()
      .then(result => {
        res.status(201).json(result);
      })
      .catch(err => {
        res.status(400).json({ message: err.message });
      });
  });

  app.post("/isTokenExpired",
    passport.authenticate("jwt", {
      session: false
    }),
    (req, res) => {
      res.status(200).json({ message: "Online" });
    });

  app.post('/registerUser', (req, res, next) => {
    passport.authenticate('register', (err, user, info) => {
      if (info !== undefined) {
        console.error(info.message);
        res.status(403).send(info.message);
      } else {
        const data = {
          first_name: req.body.first_name,
          last_name: req.body.last_name,
          email: req.body.email,
          username: user.username,
          role: "user"
        };
        console.log(data);
        db.user.findOne({
          where: {
            username: data.username,
          },
        }).then(user => {
          user.update({
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            role: data.role
          })
            .then(() => {
              console.log('user created in db');
              res.status(200).send({ message: 'user created' });
            });
        })
          .catch(err => {
            console.log(err)
          })

      }
    })(req, res, next);
  });

  app.post('/loginUser', (req, res, next) => {
    console.log('req', req.body)
    passport.authenticate('login', (err, users, info) => {
      if (err) {
        console.error(`error ${err}`);
      }
      if (info !== undefined) {
        console.error(info.message);
        if (info.message === 'bad username') {
          res.status(401).send(info.message);
        } else {
          res.status(403).send(info.message);
        }
      } else {
        db.user.findOne({
          where: {
            username: req.body.username,
          },
        }).then(user => {
          const token = jwt.sign({
            id: user.id,
            role: user.role,
            name: user.name,
            profilePic: user.profile_img_url
          }, config.jwtOptions.secretOrKey, {
            expiresIn: 3600,
          });
          res.status(200).send({
            auth: true,
            token,
            message: 'user found & logged in',
          });
        });
      }
    })(req, res, next);
  });

  async function getUserInfo(user_id) {
    const user = await db.user.findOne({
      attributes: ['id', 'name'],
      where: { id: user_id },
      raw: true
    })
    return user
  }


  app.put('/change-password', passport.authenticate('jwt', { session: false }),
    async function (req, res) {
      let targetUser = await db.user.findOne({ where: { id: req.user.id } })
      if (!targetUser) {
        res.status(404).send({ message: "user not found" })
      } else {
        var salt = bcrypt.genSaltSync(config.BCRYPT_SALT_ROUNDS);
        var newHashedPassword = bcrypt.hashSync(req.body.newPassword, salt);
        bcrypt.compare(req.body.oldPassword, req.user.password, function (err, response) {
          console.log({ response })
          if (!response) {
            res.status(401).send({ message: 'your old password is wrong.' })
          } else {
            targetUser.update({
              password: newHashedPassword
            })
            res.status(200).send({ message: "Your password is changed." })
          }
        });
      }
    })
}
