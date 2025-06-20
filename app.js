var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var morgan = require('morgan');
var cors = require('cors');

var {morganStream} = require('./logger');
var indexRouter = require('./routes/index');
var buildRouter = require('./routes/build');
var i18nRouter = require('./routes/i18n');
var deployRouter = require('./routes/deploy');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(morgan('dev', { stream: morganStream }));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(cors());
app.use(express.static(path.join(__dirname, '../static')));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/build', buildRouter);
app.use('/i18n', i18nRouter);
app.use('/deploy', deployRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
	next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500);
	res.render('error');
});

module.exports = app;
