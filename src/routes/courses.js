const KoaRouter = require('koa-router');
const parse = require('csv-parse/lib/sync');
const fs = require('fs');
const fileStorage = require('../services/file-storage');

const router = new KoaRouter();

async function loadCourse(ctx, next) {
  ctx.state.course = await ctx.orm.course.findByPk(ctx.params.id);
  return next();
}

router.get('courses.list', '/', async (ctx) => {
  const coursesList = await ctx.orm.course.findAll();

  switch (ctx.accepts(['json', 'html'])) {
    case 'json':
      ctx.body = coursesList;
      break;
    case 'html':
      await ctx.render('courses/index', {
        coursesList,
        newCoursePath: ctx.router.url('courses.new'),
        editCoursePath: (course) => ctx.router.url('courses.edit', { id: course.id }),
        deleteCoursePath: (course) => ctx.router.url('courses.delete', { id: course.id }),
        uploadCoursesPath: ctx.router.url('courses.upload'),
      });
      break;
    default:
      break;
  }
});

router.get('courses.new', '/new', async (ctx) => {
  const course = ctx.orm.course.build();
  await ctx.render('courses/new', {
    course,
    submitCoursePath: ctx.router.url('courses.create'),
  });
});

router.post('courses.create', '/', async (ctx) => {
  const course = ctx.orm.course.build(ctx.request.body);
  try {
    await course.save({ fields: ['code', 'name', 'description'] });
    ctx.redirect(ctx.router.url('courses.list'));
  } catch (validationError) {
    await ctx.render('courses.new', {
      course,
      errors: validationError.errors,
      submitCoursePath: ctx.router.url('courses.create'),
    });
  }
});

router.get('courses.edit', '/:id/edit', loadCourse, async (ctx) => {
  const { course } = ctx.state;
  await ctx.render('courses/edit', {
    course,
    submitCoursePath: ctx.router.url('courses.update', { id: course.id }),
  });
});

router.patch('courses.update', '/:id', loadCourse, async (ctx) => {
  const { course } = ctx.state;
  try {
    const { code, name, description } = ctx.request.body;
    await course.update({ code, name, description });
    ctx.redirect(ctx.router.url('courses.list'));
  } catch (validationError) {
    await ctx.render('courses/edit', {
      course,
      errors: validationError.errors,
      submitCoursePath: ctx.router.url('courses.update', { id: course.id }),
    });
  }
});

router.del('courses.delete', '/:id', loadCourse, async (ctx) => {
  const { course } = ctx.state;
  await course.destroy();
  ctx.redirect(ctx.router.url('courses.list'));
});

router.get('courses.upload', '/upload', async (ctx) => {
  await ctx.render('courses/upload', {
    submitCoursesPath: ctx.router.url('courses.load'),
  });
});

router.post('courses.load', '/upload', async (ctx) => {
  const { list } = ctx.request.files;

  const fileContent = fs.readFileSync(list.path);
  const coursesRow = parse(fileContent, { columns: true, delimiter: ';' });
  const coursesPromises = coursesRow.map((row) => {
    const course = ctx.orm.course.build(row);
    return course.save({ fields: ['code', 'name', 'description'] });
  });

  await Promise.all(coursesPromises);

  await fileStorage.upload(list);
  ctx.redirect(ctx.router.url('courses.list'));
});

module.exports = router;
