import {confirm, input, select} from '@inquirer/prompts';
import type {SelectedTemplate} from "./index.js";
import {getProjectList} from "./projects.ts";

export async function showMenu_SelectTemplate(): Promise<undefined|SelectedTemplate> {
    let projects = await getProjectList();

    let projectList = projects.projects.map(p => {
        return {
            description: p.title,
            name: p.template,
            value: p.template,
        }
    });

    let choice = await select({
        message: 'Select a project template',
        choices: projectList
    });

    if (!choice) return undefined;

    let project = projects.projects.find(p => p.template === choice);
    if (!project) return undefined;

    let options: any = {};

    if (project.options) {
        for (let option of project.options) {
            switch (option.type) {
                case "confirm":
                    options[option.code] = await confirm({message: option.title, default: option.default===true});
                    break;
                case "ask":
                    options[option.code] = await input({message: option.title, default: option.default ? option.default.toString() : undefined});
            }
        }
    }

    return {
        template: project.template, options
    }
}