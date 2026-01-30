# 📘 Contributing to AdaCAD 

Thank you for your interest in contributing to AdaCAD! Before you read on, let's make sure you are in the right place. The AdaCAD Project is a collection of different code and documentation resources:


- [AdaCAD Library Github Repo / @AdaCAD-Library](https://github.com/UnstableDesign/AdaCAD-Library): contains the core data structure and algorithms for draft making and manipulating via parameterized operations. This includes all of the code and documentation for operations. Also contains the code to render drafts for simulation. Written as a typescript library that is also hosted on as an [NPM package](https://www.npmjs.com/package/adacad-drafting-lib). 
- 🎯 **You are here** [AdaCAD UI Github Repo / @AdaCAD-UI](https://github.com/UnstableDesign/AdaCAD): An Angular project that imports the AdaCAD library and offers a series of components and features for managing the user interface. This includes a graph of relationships between on-screen operations and drafts, integrations with the user database, and functions for loading and saving files.
- [AdaCAD Docs Github Repo / @AdaCAD-Documentation](https://github.com/UnstableDesign/AdaCAD-Documentation): A Docusaurus project that imports the AdaCAD library and creates components and markdown pages that document the projects features as well as tutorials, examples, and getting started guides. 

You are currently in the **AdaCAD-UI** Repo. If that is what you intended, keep reading! 

---

## 🧾 Table of Contents

1. [Code of Conduct](#-code-of-conduct)
2. [How to Contribute](#-how-to-contribute)
3. [Getting Started](#-getting-started)
4. [Development Guidelines](#-development-guidelines)
5. [Pull Request Process](#-pull-request-process)
6. [Style Guide](#-style-guide)
7. [Reporting Issues](#-reporting-issues)
6. [License](#-license)

---

## 📜 Code of Conduct

Please review our [Code of Conduct](CODE_OF_CONDUCT.md) to understand what is expected in our community.

---

## 💡 How to Contribute

There are many ways to contribute to the UI:

* 📄 **Reporting bugs**
* ✨ **Suggesting new features**
* 🛠 **Fixing issues**
* 🌍 **Helping with translations**

---

## ⚙️ Getting Started

1. **Fork** the repository.
2. **Clone** your fork:

   ```bash
   git clone https://github.com/your-username/AdaCAD-UI.git
   ```
3. **Install dependencies**:

   ```bash
   npm install
   ```
4. **Create a branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

---

## 🧭 Development Guidelines

* Keep commits **small and focused**.
* Use **descriptive commit messages**.
* Try to best to write code that is clear with comments explaining key functions or potentially confusing elements. We can help edit the code if need be. 
* Follow the [Style Guide](#-style-guide).

---

## 🚀 Pull Request Process

1. Submit your pull request to the `main` branch and include comments about the pull, what it aims to accomplish and any anticipated challenges with the integration or security.
3. The team will review and provide feedback.
4. Make necessary changes and update your PR.

---

## 🎨 Style Guide

- please use existing imports and libraries as best as you are able instead of requiring new libraries.

- we aim to keep our Angular build up to date but sometimes it can lag behind. Please consult the documentation associated with the Angular version used by the software at the time of your contribution (the version can be found in the [package.json](package.json) file under `@angular/cdk`). 

- please use typed variables as much as you can. This helps us read your code and also catch errors. 

---

## 🐛 Reporting Issues

Please use the issue template and include:

* A clear title
* Steps to reproduce the issue
* Expected vs actual behavior
* Screenshots or logs if available

**Avoid duplicates**: Check existing issues before reporting a new one.

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the [LICENSE](LICENSE) of this repository.

---

### 🙏 Thank You

Your contributions make this project better. We appreciate your help! 💙

