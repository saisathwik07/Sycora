const Task = require("../../models/task/task.model");
const User = require("../../models/user/user.model");
const Activity = require("../../models/activity/activity.model");
const { successResponse, errorResponse } = require("../../utils/response");

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function canViewTask(task, user) {
  if (!task || !user) return false;
  if (user.role === 'super') return true;
  if (task.isDemo && task.user.toString() === user._id.toString()) return true;
  if (!user.organization || !task.organization) return false;
  return task.organization.toString() === user.organization.toString();
}

function canMutateTask(task, user) {
  if (!task || !user) return false;
  if (user.role === 'super') return true;
  if (task.isDemo && task.user.toString() === user._id.toString()) return true;
  if (user.isGuest) return false;
  if (task.user.toString() === user._id.toString()) return true;
  if (
    user.role === 'admin' &&
    user.organization &&
    task.organization &&
    task.organization.toString() === user.organization.toString()
  ) {
    return true;
  }
  return false;
}

exports.createDemoTask = async (req, res) => {
  try {
    const { title, description, deadline, priority } = req.body;

    const newTask = new Task({
      title: title || 'Demo task',
      description,
      deadline,
      priority: priority || 'Medium',
      user: req.user._id,
      isDemo: true,
      completed: false,
    });
    await newTask.save();

    successResponse(res, 201, 'Demo task created successfully', newTask);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

// Create a new task
exports.createTask = async (req, res) => {
  try {
    const { title, description, deadline, priority, userId } = req.body;
    
    const assignedUser = await User.findById(userId);
    if (!assignedUser) {
      return errorResponse(res, 404, "Assigned user not found");
    }

    const currentUser = req.currentUser;
    if (currentUser.isGuest) {
      return errorResponse(res, 403, 'Guests cannot create workspace tasks');
    }
    if (currentUser.role !== 'super') {
      if (!currentUser.organization || !assignedUser.organization || assignedUser.organization.toString() !== currentUser.organization.toString()) {
         return errorResponse(res, 403, "Cannot assign tasks to users outside your organization");
      }
    }
    
    const newTask = new Task({
      title,
      description,
      deadline,
      priority,
      user: userId,
      organization: assignedUser.organization
    });
    await newTask.save();

    // Log activity
    await new Activity({
      task: newTask._id,
      user: req.user._id,
      action: "created",
      details: `Task created and assigned to ${assignedUser.email}`,
      organization: assignedUser.organization
    }).save();

    successResponse(res, 201, "Task created successfully");
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

// Get all tasks
exports.getAllTasks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const user = req.currentUser;

    if (user.isGuest || !user.organization) {
      const filter = { user: req.user._id, isDemo: true };
      const tasks = await Task.find(filter)
        .populate('user', 'email')
        .skip(skip)
        .limit(limit);

      const totalTasks = await Task.countDocuments(filter);

      return successResponse(res, 200, 'Tasks retrieved successfully', {
        tasks,
        totalTasks,
        totalPages: Math.ceil(totalTasks / limit),
        currentPage: page,
      });
    }

    const tasks = await Task.find({
      organization: user.organization,
      isDemo: { $ne: true },
    })
    .populate('user', 'email')
    .skip(skip)
    .limit(limit);

    const totalTasks = await Task.countDocuments({
      organization: user.organization,
      isDemo: { $ne: true },
    });

    successResponse(res, 200, "Tasks retrieved successfully", {
      tasks,
      totalTasks,
      totalPages: Math.ceil(totalTasks / limit),
      currentPage: page
    });
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

// Get ongoing tasks
exports.getOngoingTasks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const priority = req.query.priority || "";
    const sortBy = req.query.sortBy || "deadline";
    const order = req.query.order === "desc" ? -1 : 1;

    const user = req.currentUser;

    if (user.isGuest || !user.organization) {
      const filter = {
        user: req.user._id,
        isDemo: true,
        completed: false,
      };

      if (search) {
        const safeSearch = escapeRegex(search);
        filter.$or = [
          { title: { $regex: safeSearch, $options: 'i' } },
          { description: { $regex: safeSearch, $options: 'i' } },
        ];
      }

      if (priority) {
        filter.priority = priority;
      }

      const sort = {};
      sort[sortBy] = order;

      const tasks = await Task.find(filter)
        .populate('user', 'email')
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const totalTasks = await Task.countDocuments(filter);

      return successResponse(res, 200, 'Ongoing tasks retrieved successfully', {
        tasks,
        totalTasks,
        totalPages: Math.ceil(totalTasks / limit),
        currentPage: page,
      });
    }

    const filter = {
      completed: false,
      organization: user.organization,
      isDemo: { $ne: true },
    };

    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { title: { $regex: safeSearch, $options: "i" } },
        { description: { $regex: safeSearch, $options: "i" } }
      ];
    }

    if (priority) {
      filter.priority = priority;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = order;

    const tasks = await Task.find(filter)
    .populate('user', 'email')
    .sort(sort)
    .skip(skip)
    .limit(limit);
    
    const totalTasks = await Task.countDocuments(filter);

    successResponse(res, 200, "Ongoing tasks retrieved successfully", {
      tasks,
      totalTasks,
      totalPages: Math.ceil(totalTasks / limit),
      currentPage: page,
    });
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

// Get completed tasks
exports.getCompletedTasks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const priority = req.query.priority || "";

    const user = req.currentUser;

    if (user.isGuest || !user.organization) {
      const filter = {
        user: req.user._id,
        isDemo: true,
        completed: true,
      };

      if (search) {
        const safeSearch = escapeRegex(search);
        filter.$or = [
          { title: { $regex: safeSearch, $options: 'i' } },
          { description: { $regex: safeSearch, $options: 'i' } },
        ];
      }

      if (priority) {
        filter.priority = priority;
      }

      const tasks = await Task.find(filter)
        .sort({ updatedAt: -1 })
        .populate('user', 'email')
        .skip(skip)
        .limit(limit);

      const totalTasks = await Task.countDocuments(filter);

      return successResponse(res, 200, 'Completed tasks retrieved successfully', {
        tasks,
        totalTasks,
        totalPages: Math.ceil(totalTasks / limit),
        currentPage: page,
      });
    }

    const filter = {
      completed: true,
      organization: user.organization,
      isDemo: { $ne: true },
    };

    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { title: { $regex: safeSearch, $options: "i" } },
        { description: { $regex: safeSearch, $options: "i" } }
      ];
    }

    if (priority) {
      filter.priority = priority;
    }

    const tasks = await Task.find(filter)
      .sort({ updatedAt: -1 })  // Sort by most recently updated first
      .populate('user', 'email')
      .skip(skip)
      .limit(limit);
      
    const totalTasks = await Task.countDocuments(filter);

    // Ensure we're sending back the proper metadata
    successResponse(res, 200, "Completed tasks retrieved successfully", {
      tasks,
      totalTasks,
      totalPages: Math.ceil(totalTasks / limit),
      currentPage: page,
    });
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

// Get all tasks for a user
exports.getAllTasksForUser = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const tasks = await Task.find({ user: req.user._id })
      .skip(skip)
      .limit(limit);
    const totalTasks = await Task.countDocuments({ user: req.user._id });

    successResponse(res, 200, "Tasks retrieved successfully", {
      tasks,
      totalTasks,
      totalPages: Math.ceil(totalTasks / limit),
      currentPage: page,
    });
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

// Get a single task by ID
exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id }).populate(
      "user",
      "-password"
    );
    if (!task) {
      return errorResponse(res, 404, "Task not found");
    }

    const currentUser = req.currentUser;
    if (!canViewTask(task, currentUser)) {
      return errorResponse(res, 403, 'Not authorized to view this task');
    }

    successResponse(res, 200, "Task retrieved successfully", task);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

// Update a task
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    
    const task = await Task.findById(id);
    if (!task) {
      return errorResponse(res, 404, "Task not found");
    }

    const currentUser = req.currentUser;
    if (!canMutateTask(task, currentUser)) {
      return errorResponse(res, 403, 'Not authorized to update this task');
    }
    
    let action = "updated";
    let details = "Task details updated";

    if (req.body.completed !== undefined && req.body.completed !== task.completed) {
      action = "status_changed";
      details = req.body.completed ? "Task marked as completed" : "Task marked as ongoing";
    } else if (req.body.subtasks) {
      action = "subtask_toggled";
      details = "Checklist updated";
    }

    const allowedFields = ['title', 'description', 'deadline', 'priority', 'completed', 'subtasks'];
    const updateData = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    }

    const updatedTask = await Task.findByIdAndUpdate(
      id, 
      updateData,
      { new: true }
    ).populate('user', 'email');
    
    const activityPayload = {
      task: updatedTask._id,
      user: req.user._id,
      action: action,
      details: details,
    };
    if (task.organization) activityPayload.organization = task.organization;
    await new Activity(activityPayload).save();

    return successResponse(res, 200, "Task updated successfully", updatedTask);
  } catch (error) {
    return errorResponse(res, 500, error.message);
  }
};

// Delete a task
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the task first to ensure it exists
    const task = await Task.findById(id);
    
    if (!task) {
      return errorResponse(res, 404, "Task not found");
    }
    
    const currentUser = req.currentUser;
    if (!canMutateTask(task, currentUser)) {
      return errorResponse(res, 403, 'Not authorized to delete this task');
    }
    
    // Log activity
    const deleteActivityPayload = {
      task: id,
      user: req.user._id,
      action: 'deleted',
      details: `Task "${task.title}" was deleted`,
    };
    if (task.organization) deleteActivityPayload.organization = task.organization;
    await new Activity(deleteActivityPayload).save();

    // Delete the task
    await Task.findByIdAndDelete(id);
    
    successResponse(res, 200, "Task deleted successfully");
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

// Get task statistics
exports.getTaskStats = async (req, res) => {
  try {
    const user = req.currentUser;

    const matchStage =
      user.isGuest || !user.organization
        ? { user: user._id, isDemo: true }
        : { organization: user.organization, isDemo: { $ne: true } };

    const stats = await Task.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: ["$completed", 1, 0] } },
          pending: { $sum: { $cond: ["$completed", 0, 1] } },
          highPriority: { $sum: { $cond: [{ $eq: ["$priority", "High"] }, 1, 0] } },
          mediumPriority: { $sum: { $cond: [{ $eq: ["$priority", "Medium"] }, 1, 0] } },
          lowPriority: { $sum: { $cond: [{ $eq: ["$priority", "Low"] }, 1, 0] } },
        },
      },
    ]);

    const result = stats.length > 0 ? stats[0] : {
      total: 0,
      completed: 0,
      pending: 0,
      highPriority: 0,
      mediumPriority: 0,
      lowPriority: 0,
    };

    successResponse(res, 200, 'Stats retrieved successfully', result);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};

// Get activity log for a task
exports.getTaskActivities = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return errorResponse(res, 404, "Task not found");
    }

    const currentUser = req.currentUser;
    if (!canViewTask(task, currentUser)) {
      return errorResponse(res, 403, "Not authorized to view this task's activities");
    }

    const activities = await Activity.find({ task: req.params.id })
      .populate("user", "email")
      .sort({ createdAt: -1 });

    successResponse(res, 200, "Activities retrieved successfully", activities);
  } catch (error) {
    errorResponse(res, 500, error.message);
  }
};
